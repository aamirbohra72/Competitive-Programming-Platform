import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Response } from 'express';
import type { AuthRequest } from '../src/middleware/auth';
import { interviewController } from '../src/controllers/interviewController';
import {
  generateFinalReport,
  gradeTurnAndGenerateNext,
  planResumeInterview,
} from '../src/services/groqAiService';

const previousFetch = globalThis.fetch;
const previousKey = process.env.GROQ_API_KEY;
const requests: Array<{ messages: Array<{ content: string }> }> = [];
let rejectFirstResumePlan = true;

process.env.GROQ_API_KEY = 'test-only';
globalThis.fetch = async (input, init) => {
  assert.match(String(input), /^https:\/\/api\.groq\.com\/openai\/v1\/chat\/completions$/);
  const request = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
  requests.push(request);
  if (rejectFirstResumePlan && /Extract up to 20 technical skills/.test(request.messages[0].content)) {
    rejectFirstResumePlan = false;
    return new Response(JSON.stringify({ error: { message: 'Failed to validate JSON. Please adjust your prompt.' } }), { status: 400 });
  }
  const system = request.messages[0].content;
  const response = /Extract up to 20 technical skills/.test(system)
    ? { skills: ['Node.js'], projects: ['Order API'], question: 'How did you handle retries in your Order API?' }
    : /You are a senior system-design interviewer in a short spoken interview/.test(system)
      ? { score: 7, feedback: 'Good start', keyPointsMissing: ['idempotency'], nextQuestion: 'What if two retries arrive at once?' }
      : {
          verdict: 'BORDERLINE', overallScore: 71, dimensions: { 'Node.js': 71 },
          weakTopics: ['idempotency'], improvementPlan: ['Add idempotency keys'],
          strengths: ['Clear API design'],
        };
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(response) } }] }), { status: 200 });
};

async function main() {
  try {
    const rejected: Array<{ status: number; error: string }> = [];
    let statusCode = 200;
    const response = {
      status(code: number) { statusCode = code; return this; },
      json(body: { error: string }) { rejected.push({ status: statusCode, error: body.error }); return this; },
    } as unknown as Response;
    await interviewController.createSession({ user: { userId: 'test-user' }, body: { mode: 'PROCTORED' } } as AuthRequest, response);
    await interviewController.createSession({
      user: { userId: 'test-user' }, body: { mode: 'PROCTORED' },
      file: { mimetype: 'application/pdf', buffer: Buffer.from('not a PDF') },
    } as AuthRequest, response);
    assert.deepEqual(rejected.map((result) => result.status), [400, 400]);

    const fixture = await readFile(join(dirname(require.resolve('pdf-parse')), 'test/data/01-valid.pdf'));
    delete process.env.GROQ_API_KEY;
    await interviewController.createSession({
      user: { userId: 'test-user' }, body: { mode: 'PROCTORED' },
      file: { mimetype: 'application/pdf', buffer: fixture },
    } as AuthRequest, response);
    assert.deepEqual(rejected.at(-1), { status: 503, error: 'Groq is not configured (missing GROQ_API_KEY).' });
    process.env.GROQ_API_KEY = 'test-only';

    const plan = await planResumeInterview('Built an Order API in Node.js with request retries and PostgreSQL storage.');
    const context = JSON.stringify({ skills: plan.skills, projects: plan.projects });
    const next = await gradeTurnAndGenerateNext(plan.question, 'Used retry logic', [], true, context);
    const report = await generateFinalReport([{ questionText: plan.question, transcript: 'Used retry logic', score: 7 }], context);

    assert.equal(requests.length, 4, 'Expected the malformed resume plan to be retried once');
    assert.match(requests[0].messages[1].content, /Order API/);
    assert.match(requests[0].messages[0].content, /high-level design/i);
    assert.match(requests[0].messages[0].content, /low-level components/i);
    assert.match(requests[1].messages[1].content, /Order API/);
    assert.match(requests[1].messages[0].content, /system-design interviewer/i);
    assert.match(requests[2].messages[0].content, /Do not turn this into a JavaScript or language-syntax interview/i);
    assert.match(requests[3].messages[1].content, /Node.js/);
    assert.match(next.nextQuestion ?? '', /retries/);
    assert.deepEqual(report.weakTopics, ['idempotency']);
    assert.match(report.detailedMarkdown, /## Architecture and scaling/);
    assert.match(report.detailedMarkdown, /## Recommendations/);
    console.log('Resume interview prompt chain passed');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});