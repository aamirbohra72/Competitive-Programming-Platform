#!/usr/bin/env node
/**
 * Docker judge entrypoint.
 * Protocol: argv or env JUDGE_REQUEST_JSON (base64) / file /workspace/request.json
 * Writes /workspace/result.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const WORK = '/workspace';
const RESULT_PATHS = ['/tmp/result.json', path.join(WORK, 'result.json')];

function writeResult(result) {
  const json = JSON.stringify(result);
  for (const resultPath of RESULT_PATHS) {
    try {
      fs.writeFileSync(resultPath, json);
      break;
    } catch {
      /* read-only root — stdout is the source of truth */
    }
  }
  process.stdout.write(json);
}

function normalizeOutput(output) {
  return String(output ?? '')
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function readRequest() {
  for (const fromFile of [path.join(WORK, 'request.json'), '/tmp/request.json']) {
    if (fs.existsSync(fromFile)) {
      return JSON.parse(fs.readFileSync(fromFile, 'utf8'));
    }
  }
  if (process.env.JUDGE_REQUEST_B64) {
    return JSON.parse(Buffer.from(process.env.JUDGE_REQUEST_B64, 'base64').toString('utf8'));
  }
  if (process.argv[2]) {
    return JSON.parse(process.argv[2]);
  }
  throw new Error('No judge request provided');
}

function runProcess(command, args, { stdin = '', timeoutMs = 5000, cwd = WORK } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, HOME: '/home/judge', PATH: process.env.PATH },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
      if (stdout.length > 1_000_000) child.kill('SIGKILL');
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 1_000_000) child.kill('SIGKILL');
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: err.message,
        exitCode: 1,
        timedOut: false,
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
        timedOut: killed,
      });
    });
    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
  });
}

async function compileAndRunStdin(language, source, input, timeoutMs) {
  const ext = { javascript: 'js', python: 'py', java: 'java', cpp: 'cpp' }[language];
  if (!ext) {
    return { ok: false, status: 'COMPILATION_ERROR', error: `Unsupported language: ${language}` };
  }

  if (language === 'java') {
    const src = path.join(WORK, 'Main.java');
    let code = source;
    if (!/class\s+Main\b/.test(code) && !/class\s+\w+/.test(code)) {
      code = `import java.util.*;\npublic class Main {\n  public static void main(String[] args) throws Exception {\n${source
        .split('\n')
        .map((l) => '    ' + l)
        .join('\n')}\n  }\n}\n`;
    } else if (/class\s+(\w+)/.test(code) && !/class\s+Main\b/.test(code)) {
      code = code.replace(/class\s+(\w+)/, 'class Main');
    }
    fs.writeFileSync(src, code);
    const compile = await runProcess('javac', [src], { timeoutMs: Math.min(timeoutMs, 15000) });
    if (compile.timedOut || compile.exitCode !== 0) {
      return {
        ok: false,
        status: compile.timedOut ? 'TIME_LIMIT_EXCEEDED' : 'COMPILATION_ERROR',
        error: compile.stderr || compile.stdout || 'javac failed',
      };
    }
    const run = await runProcess('java', ['-cp', WORK, 'Main'], { stdin: input, timeoutMs });
    if (run.timedOut) return { ok: false, status: 'TIME_LIMIT_EXCEEDED', error: 'Time limit exceeded' };
    if (run.exitCode !== 0) {
      return { ok: false, status: 'RUNTIME_ERROR', error: run.stderr || run.stdout || 'Runtime error' };
    }
    return { ok: true, output: run.stdout };
  }

  if (language === 'cpp') {
    const src = path.join(WORK, 'main.cpp');
    let code = source;
    if (!/#include/.test(code)) {
      code = `#include <bits/stdc++.h>\nusing namespace std;\n${code}`;
    }
    if (!/\bmain\s*\(/.test(code)) {
      code += `\nint main(){\n${source}\nreturn 0;\n}\n`;
    }
    fs.writeFileSync(src, code);
    const outBin = path.join(WORK, 'a.out');
    const compile = await runProcess('g++', [src, '-O2', '-std=c++17', '-o', outBin], {
      timeoutMs: Math.min(timeoutMs, 15000),
    });
    if (compile.timedOut || compile.exitCode !== 0) {
      return {
        ok: false,
        status: compile.timedOut ? 'TIME_LIMIT_EXCEEDED' : 'COMPILATION_ERROR',
        error: compile.stderr || compile.stdout || 'g++ failed',
      };
    }
    const run = await runProcess(outBin, [], { stdin: input, timeoutMs });
    if (run.timedOut) return { ok: false, status: 'TIME_LIMIT_EXCEEDED', error: 'Time limit exceeded' };
    if (run.exitCode !== 0) {
      return { ok: false, status: 'RUNTIME_ERROR', error: run.stderr || run.stdout || 'Runtime error' };
    }
    return { ok: true, output: run.stdout };
  }

  if (language === 'python') {
    const src = path.join(WORK, 'main.py');
    fs.writeFileSync(src, source);
    const run = await runProcess('python3', [src], { stdin: input, timeoutMs });
    if (run.timedOut) return { ok: false, status: 'TIME_LIMIT_EXCEEDED', error: 'Time limit exceeded' };
    if (run.exitCode !== 0) {
      return { ok: false, status: 'RUNTIME_ERROR', error: run.stderr || run.stdout || 'Runtime error' };
    }
    return { ok: true, output: run.stdout };
  }

  // javascript — real stdin for fs.readFileSync(0); also provide readLine helper
  const src = path.join(WORK, 'main.js');
  const wrapped = `
const __fs = require('fs');
const __input = ${JSON.stringify(input)};
const __lines = __input.length ? __input.split(/\\r?\\n/) : [];
let __idx = 0;
globalThis.readLine = () => (__idx < __lines.length ? __lines[__idx++] : '');
// Prefer piping stdin; also keep a buffered copy for helpers.
if (!process.stdin.isTTY) {
  /* stdin already provided by judge */
}
${source}
`;
  fs.writeFileSync(src, wrapped);
  const run = await runProcess('node', [src], { stdin: input, timeoutMs });
  if (run.timedOut) return { ok: false, status: 'TIME_LIMIT_EXCEEDED', error: 'Time limit exceeded' };
  if (run.exitCode !== 0) {
    const err = run.stderr || run.stdout || 'Runtime error';
    const status = /SyntaxError|Unexpected token|Cannot find module/i.test(err)
      ? 'COMPILATION_ERROR'
      : 'RUNTIME_ERROR';
    return { ok: false, status, error: err };
  }
  return { ok: true, output: run.stdout };
}

async function runJsFunctionHarness(source, testCase, timeoutMs) {
  const harnessPath = path.join('/judge/harnesses', 'jsFunctionHarness.mjs');
  const isCjs = /module\.exports/.test(source);
  const userPath = path.join(WORK, isCjs ? 'user.cjs' : 'user.mjs');
  fs.writeFileSync(userPath, source);
  const payloadPath = path.join(WORK, 'case.json');
  fs.writeFileSync(
    payloadPath,
    JSON.stringify({
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      specJson: testCase.specJson ?? null,
      userModule: userPath,
    }),
  );
  const run = await runProcess('node', [harnessPath, payloadPath], { timeoutMs });
  if (run.timedOut) return { ok: false, status: 'TIME_LIMIT_EXCEEDED', error: 'Time limit exceeded' };
  try {
    const parsed = JSON.parse(run.stdout || '{}');
    if (!parsed.ok) {
      return {
        ok: false,
        status: parsed.status || 'WRONG_ANSWER',
        error: parsed.error || 'Wrong answer',
        output: parsed.output ?? '',
      };
    }
    return { ok: true, output: parsed.output ?? '' };
  } catch {
    return {
      ok: false,
      status: run.exitCode === 0 ? 'WRONG_ANSWER' : 'RUNTIME_ERROR',
      error: run.stderr || run.stdout || 'Harness failed',
    };
  }
}

async function runReactHarness(source, testCase, timeoutMs) {
  const harnessPath = path.join('/judge/harnesses', 'reactHarness.mjs');
  const userPath = path.join(WORK, 'UserComponent.jsx');
  fs.writeFileSync(userPath, source);
  const payloadPath = path.join(WORK, 'case.json');
  fs.writeFileSync(
    payloadPath,
    JSON.stringify({
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      specJson: testCase.specJson ?? null,
      userFile: userPath,
    }),
  );
  const run = await runProcess('node', [harnessPath, payloadPath], { timeoutMs: Math.max(timeoutMs, 20000) });
  if (run.timedOut) return { ok: false, status: 'TIME_LIMIT_EXCEEDED', error: 'Time limit exceeded' };
  try {
    const parsed = JSON.parse(run.stdout || '{}');
    if (!parsed.ok) {
      return {
        ok: false,
        status: parsed.status || 'WRONG_ANSWER',
        error: parsed.error || 'Wrong answer',
        output: parsed.output ?? '',
      };
    }
    return { ok: true, output: parsed.output ?? '{"pass":true}' };
  } catch {
    return {
      ok: false,
      status: 'RUNTIME_ERROR',
      error: run.stderr || run.stdout || 'React harness failed',
    };
  }
}

async function main() {
  try {
    const request = readRequest();
    const {
      mode = 'STDIN',
      language = 'javascript',
      sourceCode,
      cases = [],
      timeoutMs = 5000,
      sampleOnly = false,
    } = request;

    if (!sourceCode || typeof sourceCode !== 'string') {
      writeResult({
        status: 'COMPILATION_ERROR',
        score: 0,
        feedback: 'Empty source code',
        cases: [],
        passed: 0,
        total: 0,
      });
      return;
    }

    const selected = sampleOnly ? cases.filter((c) => c.isSample) : cases;
    if (!selected.length) {
      writeResult({
        status: 'RUNTIME_ERROR',
        score: 0,
        feedback: 'No test cases available for this challenge',
        cases: [],
        passed: 0,
        total: 0,
      });
      return;
    }

    let passed = 0;
    const caseResults = [];
    let finalStatus = 'ACCEPTED';
    let feedback = '';

    for (let i = 0; i < selected.length; i += 1) {
      const tc = selected[i];
      let outcome;
      if (mode === 'JS_FUNCTION') {
        outcome = await runJsFunctionHarness(sourceCode, tc, timeoutMs);
      } else if (mode === 'REACT_COMPONENT') {
        outcome = await runReactHarness(sourceCode, tc, timeoutMs);
      } else {
        outcome = await compileAndRunStdin(language, sourceCode, tc.input ?? '', timeoutMs);
      }

      const expected = normalizeOutput(tc.expectedOutput);
      const actual = normalizeOutput(outcome.output ?? '');
      const ok = outcome.ok && (mode === 'REACT_COMPONENT' || mode === 'JS_FUNCTION' ? outcome.ok : actual === expected);

      // For harness modes, harness already validated; for STDIN compare outputs.
      let casePassed = false;
      if (!outcome.ok) {
        casePassed = false;
        finalStatus = outcome.status || 'RUNTIME_ERROR';
        feedback = outcome.error || finalStatus;
      } else if (mode === 'STDIN') {
        casePassed = actual === expected;
        if (!casePassed) {
          finalStatus = 'WRONG_ANSWER';
          feedback = tc.isHidden
            ? `Wrong answer on hidden case.`
            : `Wrong answer on ${tc.name || `case #${i + 1}`}. Expected "${expected}", got "${actual.slice(0, 200)}".`;
        }
      } else {
        casePassed = true;
      }

      caseResults.push({
        name: tc.isHidden ? 'hidden' : tc.name || `case #${i + 1}`,
        order: tc.order ?? i + 1,
        isHidden: Boolean(tc.isHidden),
        isSample: Boolean(tc.isSample),
        passed: casePassed,
        status: casePassed ? 'PASSED' : finalStatus,
        ...(tc.isHidden || casePassed
          ? {}
          : {
              expected: mode === 'STDIN' ? expected : undefined,
              actual: mode === 'STDIN' ? actual.slice(0, 500) : outcome.output?.slice?.(0, 500),
              message: feedback,
            }),
        ...(casePassed ? {} : { message: feedback || outcome.error }),
      });

      if (casePassed) {
        passed += 1;
      } else {
        // Continue running remaining cases for accurate score, but keep first failure status.
        if (!feedback) feedback = outcome.error || 'Wrong answer';
      }
    }

    const total = selected.length;
    const score = Math.round((passed / total) * 100);
    if (passed === total) {
      finalStatus = 'ACCEPTED';
      feedback = `Accepted. Passed ${passed} / ${total} test cases (${selected.filter((c) => c.isHidden).length} hidden).`;
    } else if (finalStatus === 'ACCEPTED') {
      finalStatus = 'WRONG_ANSWER';
      feedback = feedback || `Passed ${passed} / ${total} test cases.`;
    }

    writeResult({
      status: finalStatus,
      score,
      feedback,
      passed,
      total,
      cases: caseResults,
    });
  } catch (err) {
    writeResult({
      status: 'RUNTIME_ERROR',
      score: 0,
      feedback: err instanceof Error ? err.message : 'Judge error',
      passed: 0,
      total: 0,
      cases: [],
    });
  }
}

await main();
