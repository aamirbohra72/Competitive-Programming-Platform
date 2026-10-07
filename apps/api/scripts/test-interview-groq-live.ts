import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { prisma } from '@codeforces/db';
import type { Response } from 'express';
import type { AuthRequest } from '../src/middleware/auth';
import { interviewController } from '../src/controllers/interviewController';

type SessionState = {
  id: string;
  status: string;
  currentQuestionIndex: number;
  currentQuestion: string | null;
  verdict: string | null;
  overallScore: number | null;
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

async function main(): Promise<void> {
  assert.ok(process.env.GROQ_API_KEY?.trim(), 'Set GROQ_API_KEY in the ignored API .env before running this live test.');
  const userId = `groq-live-${Date.now()}`;
  let sessionId: string | null = null;
  const startedAt = Date.now();
  try {
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.test`, username: userId },
    });
    const pdf = await readFile(join(dirname(require.resolve('pdf-parse')), 'test/data/01-valid.pdf'));
    const start = responseRecorder();
    await interviewController.createSession(
      requestFor(userId, { mode: 'PROCTORED' }, {}, { mimetype: 'application/pdf', buffer: pdf }),
      start.response,
    );
    assert.equal(start.result.statusCode, 201, JSON.stringify(start.result.body));
    let state = start.result.body as SessionState;
    sessionId = state.id;
    assert.equal(state.status, 'IN_PROGRESS');
    assert.ok(state.currentQuestion);
    console.log(`Live Groq session opened: ${state.currentQuestionIndex + 1}/6`);

    const answers = [
      'I would separate the API gateway, order service, restaurant service, and payment service. Orders would be persisted transactionally, then published to a durable queue for downstream work. The first bottleneck to measure is database write contention.',
      'I would model orders and line items separately, use an idempotency key on order creation, and keep the write model normalized. Read-heavy restaurant menus can use a cache with a short TTL and explicit invalidation when a menu changes.',
      'At higher traffic I would partition by restaurant or region where access patterns support it, add read replicas for reporting, and make queue consumers horizontally scalable. I would watch hot partitions and cross-region consistency before sharding.',
      'Queue delivery is at least once, so consumers need idempotent state transitions and bounded retries with a dead-letter queue. Payment callbacks also need deduplication and reconciliation for ambiguous timeouts.',
      'For a regional outage I would fail over stateless services, preserve durable order events, and define which operations can degrade. I would test recovery time and data loss objectives rather than assume replication is sufficient.',
      'I would trace an order across the gateway, database, and queue using a correlation ID. Dashboards should include error rate, queue lag, database saturation, and p95 latency, with alerts tied to customer-visible objectives.',
    ];

    for (const [index, transcript] of answers.entries()) {
      await new Promise((resolve) => setTimeout(resolve, 12_000));
      const capture = responseRecorder();
      await interviewController.submitAnswer(
        requestFor(userId, { transcript }, { id: state.id }),
        capture.response,
      );
      assert.equal(capture.result.statusCode, 200, `Turn ${index + 1}: ${JSON.stringify(capture.result.body)}`);
      state = capture.result.body as SessionState;
      assert.equal(state.currentQuestionIndex, index + 1);
      if (index < answers.length - 1) {
        assert.equal(state.status, 'IN_PROGRESS');
        assert.ok(state.currentQuestion, `Groq did not generate the next question after turn ${index + 1}`);
      } else {
        assert.equal(state.status, 'COMPLETED');
        assert.ok(state.verdict);
        assert.ok(state.overallScore !== null);
        assert.match(state.reportDetail ?? '', /Architecture and scaling/i);
      }
      console.log(`Live Groq turn ${index + 1}/6: ${state.status}`);
    }

    console.log(JSON.stringify({
      result: 'passed',
      verdict: state.verdict,
      score: state.overallScore,
      elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
    }));
  } finally {
    if (sessionId) await prisma.interviewSession.deleteMany({ where: { id: sessionId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Live Groq interview failed');
  process.exitCode = 1;
});
