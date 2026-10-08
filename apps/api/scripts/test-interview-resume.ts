import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Response } from 'express';
import type { AuthRequest } from '../src/middleware/auth';
import { interviewController } from '../src/controllers/interviewController';
import { createInterviewSession, registerInterviewAwayWarning, sessionPublicState } from '../src/services/interviewService';
import type { InterviewSession } from '@codeforces/db';
import { prisma } from '@codeforces/db';
import {
  assertMobileChecksComplete, claimMobilePairing, classifyMobileObservation, createMobilePairing,
  getMobileStatus, hashMobileToken, makeCaptureSchedule, mobileHeartbeat,
  reconcileMobileMonitor, startMobileInterview, submitMobilePhoto,
} from '../src/services/interviewMobileService';
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

async function checkInterviewModes() {
  const originalCreate = prisma.interviewSession.create;
  const saved: Array<Partial<InterviewSession>> = [];
  try {
    Object.assign(prisma.interviewSession, {
      create: async ({ data }: { data: Partial<InterviewSession> }) => {
        saved.push(data);
        return { ...data, id: 'mode-test', proctorStartedAt: null } as InterviewSession;
      },
    });
    for (const mode of ['PRACTICE', 'PROCTORED', 'PROCTORED_PLUS'] as const) {
      const state = await createInterviewSession('test-user', undefined, mode, 'Built a Node.js order API.');
      assert.equal(state.mobileMonitoringRequired, mode === 'PROCTORED_PLUS');
      assert.equal(state.currentQuestion === null, mode === 'PROCTORED_PLUS');
    }
    assert.deepEqual(saved.map((session) => session.mode), ['PRACTICE', 'PROCTORED', 'PROCTORED']);
    console.log('Practice, Proctored, and Proctored+ mode isolation passed');
  } finally {
    prisma.interviewSession.create = originalCreate;
  }
}

async function checkMobileMonitoring() {
  const schedule = makeCaptureSchedule(1000000);
  assert.equal(schedule.length, 3);
  assert.equal(new Set(schedule.map((entry) => entry.id)).size, 3);
  assert.ok(schedule.every((entry, index) => entry.dueAt > 1000000 && (!index || entry.dueAt > schedule[index - 1].dueAt)));
  assert.notEqual(hashMobileToken('secret'), 'secret');
  assert.deepEqual(classifyMobileObservation({ personCount: 1, laptopVisible: true, clearImage: true, confidence: 0.99 }).status, 'passed');
  assert.equal(classifyMobileObservation({ personCount: 0, laptopVisible: true, clearImage: true, confidence: 0.99 }).status, 'warning');
  assert.equal(classifyMobileObservation({ personCount: 2, laptopVisible: true, clearImage: true, confidence: 0.99 }).status, 'warning');
  assert.equal(classifyMobileObservation({ personCount: 1, laptopVisible: false, clearImage: true, confidence: 0.99 }).status, 'warning');
  assert.equal(classifyMobileObservation({ personCount: 0, laptopVisible: false, clearImage: false, confidence: 0.99 }).status, 'uncertain');
  assert.equal(classifyMobileObservation({ personCount: 0, laptopVisible: false, clearImage: true, confidence: 0.5 }).status, 'uncertain');

  type Row = Record<string, unknown>;
  type Query = { where: Row; data: Row; include?: object; create: Row; update: Row };
  type MockMonitor = Row & { id: string; deviceHash: string | null; expiresAt: Date;
    lastSeenAt: Date | null; nextWarningAt: Date | null;
    schedule: ReturnType<typeof makeCaptureSchedule>; results: unknown[] };
  const session: Row & Pick<InterviewSession, 'id' | 'userId' | 'mode' | 'mobileMonitoringRequired' | 'proctorStartedAt' | 'status' | 'awayWarnings' | 'endsAt'> = { id: 'mobile-session', userId: 'owner', mode: 'PROCTORED', mobileMonitoringRequired: true,
    proctorStartedAt: null, status: 'IN_PROGRESS', awayWarnings: 0, endsAt: new Date(Date.now() + 600000) };
  let monitor: MockMonitor | null = null;
  const originalFetch = globalThis.fetch;
  const originalTransaction = prisma.$transaction;
  const originalSession = { ...prisma.interviewSession };
  const originalMonitor = { ...prisma.interviewMobileMonitor };
  const matches = (row: Row | null, where: Row) => Boolean(row && Object.entries(where).every(([key, value]) =>
    value && typeof value === 'object' && 'gt' in value ? (row[key] as Date) > (value.gt as Date) : row[key] === value));
  const update = (row: Row, data: Row) => {
    for (const [key, value] of Object.entries(data)) row[key] = value && typeof value === 'object' && 'increment' in value ? ((row[key] as number) ?? 0) + Number(value.increment) : value;
    return structuredClone(row);
  };
  const findMonitor = ({ where, include }: Query) => matches(monitor, where) ? structuredClone({ ...monitor, ...(include ? { session } : {}) }) : null;
  let observation = { personCount: 1, laptopVisible: true, clearImage: true, confidence: 0.99 };
  let visionUnavailable = false;
  try {
    Object.assign(prisma.interviewSession, {
      findFirst: async ({ where }: Query) => matches(session, where) ? structuredClone(session) : null,
      findUniqueOrThrow: async () => structuredClone(session),
      update: async ({ data }: Query) => update(session, data),
      updateMany: async ({ where, data }: Query) => matches(session, where) ? (update(session, data), { count: 1 }) : { count: 0 },
    });
    Object.assign(prisma.interviewMobileMonitor, {
      findUnique: async (input: Query) => findMonitor(input),
      findUniqueOrThrow: async (input: Query) => { const found = findMonitor(input); if (!found) throw new Error('Missing mock monitor'); return found; },
      upsert: async ({ create, update: data }: Query) => {
        if (monitor) return update(monitor, data);
        monitor = { id: 'monitor-id', deviceHash: null, connectedAt: null, lastSeenAt: null, nextWarningAt: null, schedule: [], results: [], version: 0, ...create } as MockMonitor;
        return structuredClone(monitor);
      },
      update: async ({ data }: Query) => update(monitor!, data),
      updateMany: async ({ where, data }: Query) => matches(monitor, where) ? (update(monitor!, data), { count: 1 }) : { count: 0 },
    });
    Object.assign(prisma, { $transaction: async (operation: (client: typeof prisma) => Promise<unknown>) => operation(prisma) });
    globalThis.fetch = async () => visionUnavailable
      ? new Response('{}', { status: 503 })
      : new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(observation) } }] }));

    await assert.rejects(createMobilePairing(session.id, 'other-owner'), /SESSION_NOT_FOUND/);
    session.mode = 'PRACTICE';
    await assert.rejects(createMobilePairing(session.id, 'owner'), /MOBILE_NOT_APPLICABLE/);
    session.mode = 'PROCTORED';
    const pair = await createMobilePairing(session.id, 'owner');
    assert.equal(monitor!.pairingHash, hashMobileToken(pair.token));
    await assert.rejects(startMobileInterview(session.id, 'owner'), /MOBILE_MONITOR_REQUIRED/);
    const claimed = await claimMobilePairing(pair.token);
    await assert.rejects(claimMobilePairing(pair.token), /MOBILE_TOKEN_INVALID/);
    await assert.rejects(mobileHeartbeat('wrong-token'), /MOBILE_TOKEN_INVALID/);
    assert.equal((await mobileHeartbeat(claimed.deviceToken)).captureId, null);
    await startMobileInterview(session.id, 'owner');
    assert.equal(monitor!.schedule.length, 3);
    await assert.rejects(assertMobileChecksComplete(session as InterviewSession), /MOBILE_CHECKS_PENDING/);
    const image = Buffer.alloc(200, 1);
    image.set([0xff, 0xd8, 0xff]);
    await assert.rejects(submitMobilePhoto(claimed.deviceToken, monitor!.schedule[0].id, image), /MOBILE_CAPTURE_INVALID/);
    monitor!.schedule[0].dueAt = Date.now() - 1000;
    const captureId = (await mobileHeartbeat(claimed.deviceToken)).captureId!;
    assert.equal((await submitMobilePhoto(claimed.deviceToken, captureId, image)).status, 'passed');
    await assert.rejects(submitMobilePhoto(claimed.deviceToken, captureId, image), /MOBILE_CAPTURE_INVALID/);
    await assert.rejects(submitMobilePhoto(claimed.deviceToken, captureId, Buffer.from('invalid')), /MOBILE_IMAGE_INVALID/);
    visionUnavailable = true;
    monitor!.schedule[1].dueAt = Date.now() - 1000;
    assert.equal((await submitMobilePhoto(claimed.deviceToken, monitor!.schedule[1].id, image)).status, 'uncertain');
    assert.equal(session.awayWarnings, 0, 'Provider failures must never add warnings');
    visionUnavailable = false;
    observation = { personCount: 0, laptopVisible: true, clearImage: true, confidence: 0.99 };
    session.awayWarnings = 3;
    monitor!.schedule[2].dueAt = Date.now() - 1000;
    assert.equal((await submitMobilePhoto(claimed.deviceToken, monitor!.schedule[2].id, image)).status, 'warning');
    assert.equal(session.awayWarnings, 4);
    assert.equal(session.status, 'ABANDONED');
    await assert.rejects(mobileHeartbeat(claimed.deviceToken), /SESSION_NOT_ACTIVE/);

    session.status = 'IN_PROGRESS'; session.awayWarnings = 0;
    const originalEndsAt = session.endsAt;
    session.endsAt = new Date(Date.now() - 120000);
    monitor!.lastSeenAt = new Date(session.endsAt.getTime() - 1000);
    await assertMobileChecksComplete(session as InterviewSession);
    session.endsAt = originalEndsAt;
    monitor!.schedule = []; monitor!.results = [];
    monitor!.lastSeenAt = new Date(Date.now() - 200000);
    monitor!.nextWarningAt = new Date(Date.now() - 150000);
    await reconcileMobileMonitor(session as InterviewSession);
    assert.equal(session.awayWarnings, 3);
    await reconcileMobileMonitor(session as InterviewSession);
    assert.equal(session.awayWarnings, 3, 'Polling must not replay the same disconnect warning');
    monitor!.nextWarningAt = new Date(Date.now() - 1);
    await reconcileMobileMonitor(session as InterviewSession);
    assert.equal((await getMobileStatus(session.id, 'owner')).status, 'ABANDONED');
    session.status = 'IN_PROGRESS'; session.awayWarnings = 0;
    monitor!.lastSeenAt = new Date(); monitor!.nextWarningAt = new Date(Date.now() + 45000);
    monitor!.schedule = [{ id: 'missed', dueAt: Date.now() - 50000 }]; monitor!.results = [];
    await reconcileMobileMonitor(session as InterviewSession);
    await reconcileMobileMonitor(session as InterviewSession);
    assert.equal(session.awayWarnings, 1, 'Missed captures must add exactly one warning');
    session.mobileMonitoringRequired = false;
    assert.equal(await reconcileMobileMonitor(session as InterviewSession), session, 'Practice must not reconcile mobile monitoring');
    await assertMobileChecksComplete(session as InterviewSession);
    session.mobileMonitoringRequired = true; session.proctorStartedAt = null;
    monitor!.expiresAt = new Date(Date.now() - 1); monitor!.deviceHash = null;
    await assert.rejects(claimMobilePairing(pair.token), /MOBILE_TOKEN_INVALID/);
    console.log('Mobile monitoring security and warning checks passed');
  } finally {
    Object.assign(prisma.interviewSession, originalSession);
    Object.assign(prisma.interviewMobileMonitor, originalMonitor);
    prisma.$transaction = originalTransaction;
    globalThis.fetch = originalFetch;
  }
}

async function checkDatabaseMobileMonitoring() {
  const identifier = `mobile-test-${randomUUID()}`;
  const originalFetch = globalThis.fetch;
  const user = await prisma.user.create({ data: { email: `${identifier}@example.invalid`, username: identifier } });
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      personCount: 1, laptopVisible: false, clearImage: true, confidence: 0.99,
    }) } }] }));
    const session = await prisma.interviewSession.create({ data: {
      userId: user.id, template: 'RESUME_SYSTEM_DESIGN_10M', mode: 'PROCTORED', mobileMonitoringRequired: true,
      endsAt: new Date(Date.now() + 600000), currentQuestionText: 'Test question',
    } });
    const practice = await prisma.interviewSession.create({ data: {
      userId: user.id, template: 'RESUME_SYSTEM_DESIGN_10M', mode: 'PRACTICE', endsAt: new Date(Date.now() + 600000),
    } });
    await assert.rejects(createMobilePairing(practice.id, user.id), /MOBILE_NOT_APPLICABLE/);
    await assert.rejects(registerInterviewAwayWarning(practice.id, user.id), /SESSION_NOT_ACTIVE/);
    await assert.rejects(startMobileInterview(session.id, user.id), /MOBILE_MONITOR_REQUIRED/);
    const pairing = await createMobilePairing(session.id, user.id);
    const claims = await Promise.allSettled([claimMobilePairing(pairing.token), claimMobilePairing(pairing.token)]);
    assert.equal(claims.filter((claim) => claim.status === 'fulfilled').length, 1, 'Exactly one simultaneous QR claim should succeed');
    const claimed = claims.find((claim) => claim.status === 'fulfilled') as PromiseFulfilledResult<{ deviceToken: string }>;
    const token = claimed.value.deviceToken;
    const started = await startMobileInterview(session.id, user.id);
    assert.ok(started.proctorStartedAt);
    await assert.rejects(createMobilePairing(session.id, user.id), /MOBILE_ALREADY_STARTED/);
    const monitor = await prisma.interviewMobileMonitor.findUniqueOrThrow({ where: { sessionId: session.id } });
    assert.equal(monitor.deviceHash, hashMobileToken(token));
    const schedule = monitor.schedule as ReturnType<typeof makeCaptureSchedule>;
    const image = Buffer.alloc(200, 1); image.set([0xff, 0xd8, 0xff]);
    for (let index = 0; index < 3; index += 1) {
      schedule[index].dueAt = Date.now() - 1000;
      await prisma.interviewMobileMonitor.update({ where: { id: monitor.id }, data: { schedule } });
      if (index === 0) {
        const uploads = await Promise.allSettled([
          submitMobilePhoto(token, schedule[index].id, image), submitMobilePhoto(token, schedule[index].id, image),
        ]);
        assert.equal(uploads.filter((upload) => upload.status === 'fulfilled').length, 1, 'A simultaneous photo replay must not double-count');
        assert.equal((await getMobileStatus(session.id, user.id)).warnings, 1);
        await assert.rejects(assertMobileChecksComplete(started), /MOBILE_CHECKS_PENDING/);
        await registerInterviewAwayWarning(session.id, user.id);
      } else {
        await submitMobilePhoto(token, schedule[index].id, image);
      }
    }
    const final = await getMobileStatus(session.id, user.id);
    assert.equal(final.warnings, 4);
    assert.equal(final.status, 'ABANDONED');
    assert.equal(final.checks.length, 3);
    await assert.rejects(mobileHeartbeat(token), /SESSION_NOT_ACTIVE/);
    assert.equal((await prisma.interviewSession.findUniqueOrThrow({ where: { id: practice.id } })).awayWarnings, 0);
    console.log('PostgreSQL mobile pairing, concurrent replay, persistence, and disqualification checks passed');
  } finally {
    globalThis.fetch = originalFetch;
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

async function main() {
  try {
    const session = {
      id: 'test-session', status: 'IN_PROGRESS', currentQuestion: 0,
      currentQuestionText: 'Hidden until paired', startedAt: new Date(),
      endsAt: new Date(Date.now() + 600000), mobileMonitoringRequired: true, proctorStartedAt: null,
    } as InterviewSession;
    assert.equal(sessionPublicState(session).currentQuestion, null);
    assert.equal(sessionPublicState({ ...session, mobileMonitoringRequired: false }).currentQuestion, 'Hidden until paired');
    assert.equal(sessionPublicState({ ...session, proctorStartedAt: new Date() }).currentQuestion, 'Hidden until paired');
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
    await checkInterviewModes();
    await checkMobileMonitoring();
    if (process.env.TEST_MOBILE_DB === 'true') await checkDatabaseMobileMonitoring();
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