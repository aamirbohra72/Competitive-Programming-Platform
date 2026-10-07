import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { prisma } from '@codeforces/db';
import type { Response } from 'express';
import type { AuthRequest } from '../src/middleware/auth';
import { interviewController } from '../src/controllers/interviewController';

const LOAD_SESSIONS = 5;
const previousFetch = globalThis.fetch;
const previousKey = process.env.GROQ_API_KEY;
let chatCalls = 0;
let transcriptionCalls = 0;
let activeProviderCalls = 0;
let maxConcurrentProviderCalls = 0;

process.env.GROQ_API_KEY = 'test-only';

type SessionState = {
  id: string;
  status: string;
  currentQuestionIndex: number;
  currentQuestion: string | null;
  awayWarnings: number;
  reportDetail: string | null;
};

type Capture = { statusCode: number; body: unknown };

function responseRecorder(): { response: Response; result: Capture } {
  const result: Capture = { statusCode: 200, body: null };
  const response = {
    status(code: number) { result.statusCode = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  } as unknown as Response;
  return { response, result };
}

function requestFor(userId: string, body: Record<string, unknown> = {}, params: Record<string, string> = {}, file?: unknown): AuthRequest {
  return { user: { userId }, body, params, file } as unknown as AuthRequest;
}

async function waitForMockLatency(): Promise<void> {
  activeProviderCalls += 1;
  maxConcurrentProviderCalls = Math.max(maxConcurrentProviderCalls, activeProviderCalls);
  await new Promise((resolve) => setTimeout(resolve, 15));
  activeProviderCalls -= 1;
}

globalThis.fetch = async (input, init) => {
  const url = String(input);
  await waitForMockLatency();
  if (url === 'https://api.groq.com/openai/v1/audio/transcriptions') {
    transcriptionCalls += 1;
    assert.ok(init?.body instanceof FormData);
    return new Response(JSON.stringify({ text: 'I would partition the data and add an asynchronous queue with idempotent consumers.' }), { status: 200 });
  }

  assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
  chatCalls += 1;
  const request = JSON.parse(String(init?.body)) as {
    model: string;
    messages: Array<{ role: string; content: string }>;
  };
  assert.ok(request.model);
  assert.deepEqual(request.messages.map((message) => message.role), ['system', 'user']);
  const system = request.messages[0].content;
  const output = system.includes('Extract up to 20 technical skills')
    ? { skills: ['distributed systems', 'PostgreSQL'], projects: ['Order API'], question: 'How would you design the Order API to handle a tenfold increase in traffic?' }
    : system.includes('You are a senior system-design interviewer in a short spoken interview')
      ? {
          score: 8,
          feedback: 'Clear architecture and scaling choices.',
          keyPointsMissing: ['Discuss failure recovery'],
          nextQuestion: system.includes('End the interview and return a null nextQuestion.') ? null : 'How would you make writes idempotent when the queue retries a message?',
        }
      : {
          verdict: 'SELECT',
          overallScore: 86,
          dimensions: { architecture: 88, scalability: 84, reliability: 82 },
          weakTopics: ['failure recovery'],
          improvementPlan: ['Practice failure-mode analysis'],
          strengths: ['Clear trade-off reasoning'],
          detailedMarkdown: '## Architecture and scaling\nStrong system-design reasoning.',
        };
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }), { status: 200 });
};

async function createProctoredSession(userId: string, pdf: Buffer): Promise<SessionState> {
  const capture = responseRecorder();
  await interviewController.createSession(
    requestFor(userId, { mode: 'PROCTORED' }, {}, { mimetype: 'application/pdf', buffer: pdf }),
    capture.response,
  );
  assert.equal(capture.result.statusCode, 201, JSON.stringify(capture.result.body));
  return capture.result.body as SessionState;
}

async function main(): Promise<void> {
  const userId = `groq-load-${Date.now()}`;
  try {
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.test`, username: userId },
    });
    const pdf = await readFile(join(dirname(require.resolve('pdf-parse')), 'test/data/01-valid.pdf'));

    const warningSession = await createProctoredSession(userId, pdf);
    for (let warning = 1; warning <= 4; warning += 1) {
      const capture = responseRecorder();
      await interviewController.registerAwayWarning(
        requestFor(userId, { reason: 'tab-hidden' }, { id: warningSession.id }),
        capture.response,
      );
      assert.equal(capture.result.statusCode, 200);
      const state = capture.result.body as SessionState;
      assert.equal(state.awayWarnings, warning);
      assert.equal(state.status, warning === 4 ? 'ABANDONED' : 'IN_PROGRESS');
    }

    const sessions = await Promise.all(
      Array.from({ length: LOAD_SESSIONS }, () => createProctoredSession(userId, pdf)),
    );
    await Promise.all(sessions.map(async (session, sessionIndex) => {
      let state = session;
      for (let answerIndex = 0; answerIndex < 6; answerIndex += 1) {
        const capture = responseRecorder();
        const typedAnswer = sessionIndex === 0 && answerIndex === 0;
        const request = typedAnswer
          ? requestFor(userId, { transcript: 'I would separate writes behind a durable queue and use idempotency keys.' }, { id: session.id })
          : requestFor(userId, {}, { id: session.id }, {
              buffer: Buffer.from(`synthetic-audio-${sessionIndex}-${answerIndex}`),
              originalname: 'answer.webm',
              mimetype: 'audio/webm',
            });
        await interviewController.submitAnswer(request, capture.response);
        assert.equal(capture.result.statusCode, 200, JSON.stringify(capture.result.body));
        state = capture.result.body as SessionState;
        if (answerIndex < 5) {
          assert.equal(state.status, 'IN_PROGRESS');
          assert.ok(state.currentQuestion);
        } else {
          assert.equal(state.status, 'COMPLETED');
          assert.equal(state.currentQuestionIndex, 6);
          assert.match(state.reportDetail ?? '', /Architecture and scaling/);
        }
      }
    }));

    assert.equal(transcriptionCalls, LOAD_SESSIONS * 6 - 1);
    assert.equal(chatCalls, 1 + LOAD_SESSIONS + (LOAD_SESSIONS * 6) + LOAD_SESSIONS);
    assert.ok(maxConcurrentProviderCalls > 1, 'Expected concurrent provider calls during the load run');
    console.log(`Groq interview E2E passed: ${LOAD_SESSIONS} concurrent proctored sessions, 30 answers, audio and typed input, reports, and four-warning disqualification (mock provider concurrency ${maxConcurrentProviderCalls}).`);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
