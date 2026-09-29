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
} from '../src/services/mistralInterviewService';

const previousFetch = globalThis.fetch;
const previousKey = process.env.MISTRAL_API_KEY;
const requests: Array<{ messages: Array<{ content: string }> }> = [];

process.env.MISTRAL_API_KEY = 'test-only';
globalThis.fetch = async (_input, init) => {
  const request = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
  requests.push(request);
  const response = requests.length === 1
    ? { skills: ['Node.js'], projects: ['Order API'], question: 'How did you handle retries in your Order API?' }
    : requests.length === 2
      ? { score: 7, feedback: 'Good start', keyPointsMissing: ['idempotency'], nextQuestion: 'What if two retries arrive at once?' }
      : {
          verdict: 'BORDERLINE', overallScore: 71, dimensions: { 'Node.js': 71 },
          weakTopics: ['idempotency'], improvementPlan: ['Add idempotency keys'],
          strengths: ['Clear API design'], detailedMarkdown: '## Skill gaps\nIdempotency',
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
    delete process.env.MISTRAL_API_KEY;
    await assert.rejects(
      interviewController.createSession({
        user: { userId: 'test-user' }, body: { mode: 'PROCTORED' },
        file: { mimetype: 'application/pdf', buffer: fixture },
      } as AuthRequest, response),
      /MISTRAL_API_KEY is not configured/,
    );
    assert.equal(rejected.length, 2);
    process.env.MISTRAL_API_KEY = 'test-only';

    const plan = await planResumeInterview('Built an Order API in Node.js with request retries and PostgreSQL storage.');
    const context = JSON.stringify({ skills: plan.skills, projects: plan.projects });
    const next = await gradeTurnAndGenerateNext(plan.question, 'Used retry logic', [], true, context);
    const report = await generateFinalReport([{ questionText: plan.question, transcript: 'Used retry logic', score: 7 }], context);

    assert.match(requests[0].messages[1].content, /Order API/);
    assert.match(requests[1].messages[1].content, /Order API/);
    assert.match(requests[2].messages[1].content, /Node.js/);
    assert.match(next.nextQuestion ?? '', /retries/);
    assert.deepEqual(report.weakTopics, ['idempotency']);
    console.log('Resume interview prompt chain passed');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.MISTRAL_API_KEY;
    else process.env.MISTRAL_API_KEY = previousKey;
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});