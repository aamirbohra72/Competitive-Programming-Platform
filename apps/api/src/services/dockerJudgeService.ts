import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { AppError } from '../lib/errors';

export type JudgeCaseInput = {
  name?: string;
  input: string;
  expectedOutput: string;
  isSample?: boolean;
  isHidden?: boolean;
  order?: number;
  specJson?: string | null;
};

export type JudgeCaseResult = {
  name: string;
  order: number;
  isHidden: boolean;
  isSample: boolean;
  passed: boolean;
  status: string;
  expected?: string;
  actual?: string;
  message?: string;
};

export type DockerJudgeResult = {
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED' | 'RUNTIME_ERROR' | 'COMPILATION_ERROR';
  score: number;
  feedback: string;
  passed: number;
  total: number;
  cases: JudgeCaseResult[];
};

export type DockerJudgeRequest = {
  mode: 'STDIN' | 'JS_FUNCTION' | 'REACT_COMPONENT';
  language: string;
  sourceCode: string;
  cases: JudgeCaseInput[];
  timeoutMs?: number;
  sampleOnly?: boolean;
};

const IMAGE = process.env.JUDGE_DOCKER_IMAGE?.trim() || 'codeforces-judge:1';
const DOCKER_BIN = process.env.DOCKER_BIN?.trim() || 'docker';
const DOCKER_CACHE_MS = 30_000;

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const JUDGE_CONCURRENCY = envInt('JUDGE_CONCURRENCY', 2);
const JUDGE_QUEUE_MAX = envInt('JUDGE_QUEUE_MAX', 8);

export class DockerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DockerUnavailableError';
  }
}

let dockerOkUntil = 0;
let running = 0;
let waiting: Array<{
  resolve: () => void;
  reject: (err: Error) => void;
}> = [];

export function isJudgeEnabled(): boolean {
  return process.env.JUDGE_ENABLED !== 'false';
}

/** Docker is required for /api/ready only when explicitly enabled, or in production. */
export function isJudgeRequiredForReady(): boolean {
  if (process.env.JUDGE_ENABLED === 'false') return false;
  if (process.env.JUDGE_ENABLED === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

export function judgeHasCapacity(): boolean {
  return running < JUDGE_CONCURRENCY || waiting.length < JUDGE_QUEUE_MAX;
}

export function getJudgeLoad(): { running: number; waiting: number; concurrency: number; queueMax: number } {
  return {
    running,
    waiting: waiting.length,
    concurrency: JUDGE_CONCURRENCY,
    queueMax: JUDGE_QUEUE_MAX,
  };
}

function acquireJudgeSlot(): Promise<void> {
  if (running < JUDGE_CONCURRENCY) {
    running += 1;
    return Promise.resolve();
  }
  if (waiting.length >= JUDGE_QUEUE_MAX) {
    return Promise.reject(
      new AppError('JUDGE_BUSY', 429, 'Judge is busy, try again shortly'),
    );
  }
  return new Promise((resolve, reject) => {
    waiting.push({
      resolve: () => {
        running += 1;
        resolve();
      },
      reject,
    });
  });
}

function releaseJudgeSlot(): void {
  running = Math.max(0, running - 1);
  const next = waiting.shift();
  if (next) {
    next.resolve();
  }
}

export async function drainJudgeSlots(timeoutMs = 8_000): Promise<void> {
  const start = Date.now();
  while (running > 0 && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const waiter of waiting.splice(0)) {
    waiter.reject(new AppError('JUDGE_BUSY', 503, 'Judge shutting down'));
  }
}

async function ensureDockerUncached(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(DOCKER_BIN, ['info'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => {
      err += d.toString();
    });
    child.on('error', () => reject(new DockerUnavailableError('Docker CLI is not available')));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new DockerUnavailableError(err.trim() || 'Docker daemon is not running'));
    });
  });
}

async function ensureDocker(): Promise<void> {
  if (Date.now() < dockerOkUntil) return;
  await ensureDockerUncached();
  dockerOkUntil = Date.now() + DOCKER_CACHE_MS;
}

function runDocker(args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(DOCKER_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Docker judge timed out'));
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

function parseJudgeStdout(stdout: string): DockerJudgeResult | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as DockerJudgeResult;
  } catch {
    const start = trimmed.lastIndexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as DockerJudgeResult;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isDockerFlake(err: unknown, stderr = '', code?: number): boolean {
  if (err instanceof DockerUnavailableError) return true;
  const msg = [
    err instanceof Error ? err.message : '',
    stderr,
    code != null ? `exit ${code}` : '',
  ]
    .join(' ')
    .toLowerCase();
  if (msg.includes('timed out') || msg.includes('timeout')) return true;
  if (msg.includes('cannot connect') || msg.includes('daemon')) return true;
  if (msg.includes('econnreset') || msg.includes('econnrefused')) return true;
  if (code === 125 || code === 126 || code === 127) return true;
  return false;
}

async function runDockerJudgeOnce(request: DockerJudgeRequest): Promise<DockerJudgeResult> {
  await ensureDocker();

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-judge-'));
  const requestPath = path.join(workDir, 'request.json');

  try {
    await fs.writeFile(requestPath, JSON.stringify(request), 'utf8');

    const memory = process.env.JUDGE_MEMORY_LIMIT?.trim() || '256m';
    const cpus = process.env.JUDGE_CPUS?.trim() || '1';
    const pids = process.env.JUDGE_PIDS_LIMIT?.trim() || '64';
    const outerTimeout =
      (request.timeoutMs ?? 5000) * Math.max(1, request.cases.length) + 30_000;

    const args = [
      'run',
      '--rm',
      '--network',
      'none',
      '--read-only',
      '--tmpfs',
      '/workspace:rw,size=64m,uid=10001,gid=10001,mode=1777',
      '--tmpfs',
      '/tmp:rw,size=32m,uid=10001,gid=10001,mode=1777',
      '--memory',
      memory,
      '--cpus',
      cpus,
      '--pids-limit',
      pids,
      '--user',
      '10001:10001',
      '--security-opt',
      'no-new-privileges',
      '--cap-drop',
      'ALL',
      '-v',
      `${requestPath}:/workspace/request.json:ro`,
      IMAGE,
    ];

    const { stdout, stderr, code } = await runDocker(args, outerTimeout);
    const parsed = parseJudgeStdout(stdout);

    if (!parsed) {
      if (isDockerFlake(null, stderr, code)) {
        dockerOkUntil = 0;
        throw new Error(stderr || `Judge container failed (exit ${code})`);
      }
      return {
        status: 'RUNTIME_ERROR',
        score: 0,
        feedback: stderr || stdout || `Judge container failed (exit ${code})`,
        passed: 0,
        total: request.cases.length,
        cases: [],
      };
    }

    return parsed;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function runDockerJudge(request: DockerJudgeRequest): Promise<DockerJudgeResult> {
  await acquireJudgeSlot();
  try {
    try {
      return await runDockerJudgeOnce(request);
    } catch (err) {
      if (isDockerFlake(err)) {
        dockerOkUntil = 0;
        return await runDockerJudgeOnce(request);
      }
      throw err;
    }
  } finally {
    releaseJudgeSlot();
  }
}

export async function isDockerJudgeAvailable(): Promise<boolean> {
  try {
    await ensureDocker();
    return true;
  } catch {
    dockerOkUntil = 0;
    return false;
  }
}

export function newJudgeJobId(): string {
  return randomUUID();
}
