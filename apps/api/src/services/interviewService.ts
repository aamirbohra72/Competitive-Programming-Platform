import {
  prisma,
  InterviewSessionStatus,
  InterviewVerdict,
  type InterviewSession,
} from '@codeforces/db';
import {
  transcribeAudio,
  planResumeInterview,
  gradeTurnAndGenerateNext,
  generateFinalReport,
} from './groqAiService';
import { assertMobileChecksComplete, reconcileMobileMonitor } from './interviewMobileService';

export const INTERVIEW_TEMPLATE_RESUME_10M = 'RESUME_SYSTEM_DESIGN_10M';

/** Wall-clock duration for the interview slot (ms). */
export const INTERVIEW_DURATION_MS = 10 * 60 * 1000;

/** A short cap keeps the adaptive spoken session inside its ten-minute slot. */
export const INTERVIEW_MAX_QUESTIONS = 6;

export const INITIAL_SYSTEM_DESIGN_QUESTION =
  'Choose a project from your resume. How would you design its main components, data flow, and APIs, then scale it reliably as usage grows?';

/** Used only to let sessions created before adaptive questions were deployed finish safely. */
const LEGACY_JS_ENGINEER_QUESTIONS: readonly string[] = [
  'A web page fetches user data when it loads, but sometimes renders stale data after the user quickly switches accounts. How would you diagnose and fix this asynchronous JavaScript problem?',
  'What is the event loop, and how do the microtask queue and macrotasks like setTimeout interact?',
  'How is the value of this determined in JavaScript for regular and arrow functions?',
  'Compare async and await with Promise chains. When would you choose one over the other?',
  'What are ES modules, and how do they differ from CommonJS require?',
  'How would you structure error handling in an asynchronous Express route handler?',
] as const;

function assertGroqConfigured(): void {
  if (!process.env.GROQ_API_KEY?.trim()) {
    throw new Error('GROQ_API_KEY_MISSING');
  }
}

async function loadSessionForUser(
  sessionId: string,
  userId: string
): Promise<InterviewSession | null> {
  return prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
}

export function sessionPublicState(session: InterviewSession) {
  const now = new Date();
  const expired = now > session.endsAt;
  const currentQuestion =
    session.status === InterviewSessionStatus.IN_PROGRESS &&
    (!session.mobileMonitoringRequired || session.proctorStartedAt !== null) &&
    session.currentQuestion < INTERVIEW_MAX_QUESTIONS
      ? session.currentQuestionText ??
        LEGACY_JS_ENGINEER_QUESTIONS[session.currentQuestion] ??
        null
      : null;

  return {
    id: session.id,
    template: session.template,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    endsAt: session.endsAt.toISOString(),
    serverNow: now.toISOString(),
    timeExpired: expired,
    awayWarnings: session.awayWarnings,
    mobileMonitoringRequired: session.mobileMonitoringRequired,
    proctorStartedAt: session.proctorStartedAt?.toISOString() ?? null,
    currentQuestionIndex: session.currentQuestion,
    totalQuestions: INTERVIEW_MAX_QUESTIONS,
    currentQuestion,
    verdict: session.verdict,
    overallScore: session.overallScore,
    summaryJson: session.summaryJson,
    reportDetail: session.reportDetail,
  };
}

export async function createInterviewSession(
  userId: string,
  template: string = INTERVIEW_TEMPLATE_RESUME_10M,
  mode: 'PRACTICE' | 'PROCTORED' | 'PROCTORED_PLUS' = 'PRACTICE',
  resumeText?: string,
): Promise<ReturnType<typeof sessionPublicState>> {
  if (template !== INTERVIEW_TEMPLATE_RESUME_10M) {
    throw new Error('UNKNOWN_TEMPLATE');
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + INTERVIEW_DURATION_MS);
  const resumePlan = resumeText ? await planResumeInterview(resumeText) : null;

  const session = await prisma.interviewSession.create({
    data: {
      userId,
      template,
      mode: mode === 'PRACTICE' ? 'PRACTICE' : 'PROCTORED',
      mobileMonitoringRequired: mode === 'PROCTORED_PLUS' && Boolean(resumeText),
      resumeContext: resumePlan ? JSON.stringify({ skills: resumePlan.skills, projects: resumePlan.projects }) : null,
      startedAt,
      endsAt,
      currentQuestion: 0,
      currentQuestionText: resumePlan?.question ?? INITIAL_SYSTEM_DESIGN_QUESTION,
      status: InterviewSessionStatus.IN_PROGRESS,
    },
  });

  return sessionPublicState(session);
}

export async function getInterviewSession(sessionId: string, userId: string) {
  const session = await loadSessionForUser(sessionId, userId);
  if (!session) return null;
  return sessionPublicState(await reconcileMobileMonitor(session));
}

export async function disqualifyInterviewSession(
  sessionId: string,
  userId: string,
  reason: string,
) {
  const updated = await prisma.interviewSession.updateMany({
    where: { id: sessionId, userId, status: InterviewSessionStatus.IN_PROGRESS },
    data: {
      status: InterviewSessionStatus.ABANDONED,
      currentQuestionText: null,
      summaryJson: JSON.stringify({ disqualified: true, reason }),
      reportDetail: `Disqualified: ${reason}`,
    },
  });
  if (updated.count === 0) throw new Error('SESSION_NOT_ACTIVE');
  const session = await loadSessionForUser(sessionId, userId);
  if (!session) throw new Error('SESSION_NOT_FOUND');
  return sessionPublicState(session);
}

export async function registerInterviewAwayWarning(sessionId: string, userId: string) {
  const incremented = await prisma.interviewSession.updateMany({
    where: { id: sessionId, userId, mode: 'PROCTORED', status: InterviewSessionStatus.IN_PROGRESS },
    data: { awayWarnings: { increment: 1 } },
  });
  if (incremented.count === 0) throw new Error('SESSION_NOT_ACTIVE');

  const session = await loadSessionForUser(sessionId, userId);
  if (!session) throw new Error('SESSION_NOT_FOUND');

  if (session.awayWarnings >= 4) {
    await prisma.interviewSession.updateMany({
      where: {
        id: sessionId,
        userId,
        status: InterviewSessionStatus.IN_PROGRESS,
        awayWarnings: { gte: 4 },
      },
      data: {
        status: InterviewSessionStatus.ABANDONED,
        currentQuestionText: null,
        summaryJson: JSON.stringify({ disqualified: true, reason: 'repeated-away-events', awayWarnings: session.awayWarnings }),
        reportDetail: 'Disqualified after four proctoring away warnings.',
      },
    });
  }

  const updated = await loadSessionForUser(sessionId, userId);
  if (!updated) throw new Error('SESSION_NOT_FOUND');
  return sessionPublicState(updated);
}

export async function finishInterviewSession(sessionId: string, userId: string) {
  const found = await loadSessionForUser(sessionId, userId);
  if (!found) throw new Error('SESSION_NOT_FOUND');
  const session = await reconcileMobileMonitor(found);
  if (session.status !== InterviewSessionStatus.IN_PROGRESS) throw new Error('SESSION_NOT_ACTIVE');
  if (session.mobileMonitoringRequired && !session.proctorStartedAt) throw new Error('MOBILE_MONITOR_REQUIRED');
  await assertMobileChecksComplete(session);

  const turns = await prisma.interviewTurn.findMany({
    where: { sessionId },
    orderBy: { order: 'asc' },
    select: { questionText: true, transcript: true, score: true },
  });
  const report = turns.length > 0 ? await generateFinalReport(turns, session.resumeContext) : null;
  const latest = await reconcileMobileMonitor(await prisma.interviewSession.findUniqueOrThrow({ where: { id: sessionId } }));
  if (latest.status !== InterviewSessionStatus.IN_PROGRESS) throw new Error('SESSION_NOT_ACTIVE');
  await assertMobileChecksComplete(latest);
  const updated = await prisma.interviewSession.updateMany({
    where: { id: sessionId, userId, status: InterviewSessionStatus.IN_PROGRESS },
    data: {
      status: InterviewSessionStatus.COMPLETED,
      currentQuestionText: null,
      verdict: report?.verdict as InterviewVerdict | undefined,
      overallScore: report ? Math.round(report.overallScore) : null,
      summaryJson: JSON.stringify(report ? {
        verdict: report.verdict,
        overallScore: report.overallScore,
        dimensions: report.dimensions ?? {},
        weakTopics: report.weakTopics,
        resumeSkillGaps: session.resumeContext ? report.weakTopics : [],
        improvementPlan: report.improvementPlan,
        strengths: report.strengths,
      } : { strengths: [], weakTopics: [], improvementPlan: [] }),
      reportDetail: report?.detailedMarkdown ?? 'No answers were recorded, so there is not enough evidence to assess skills.',
    },
  });
  if (updated.count === 0) throw new Error('SESSION_NOT_ACTIVE');
  const completed = await loadSessionForUser(sessionId, userId);
  if (!completed) throw new Error('SESSION_NOT_FOUND');
  return sessionPublicState(completed);
}

export async function submitInterviewAnswer(
  sessionId: string,
  userId: string,
  input: { audioBuffer?: Buffer; audioFilename?: string; transcript?: string }
) {
  assertGroqConfigured();

  const found = await loadSessionForUser(sessionId, userId);
  if (!found) {
    throw new Error('SESSION_NOT_FOUND');
  }
  const session = await reconcileMobileMonitor(found);
  if (session.status !== InterviewSessionStatus.IN_PROGRESS) {
    throw new Error('SESSION_NOT_ACTIVE');
  }
  if (session.mobileMonitoringRequired && !session.proctorStartedAt) {
    throw new Error('MOBILE_MONITOR_REQUIRED');
  }

  const now = new Date();
  if (now > session.endsAt) {
    throw new Error('TIME_EXPIRED');
  }

  const qIndex = session.currentQuestion;
  if (qIndex >= INTERVIEW_MAX_QUESTIONS) {
    throw new Error('NO_MORE_QUESTIONS');
  }
  if (qIndex === INTERVIEW_MAX_QUESTIONS - 1) await assertMobileChecksComplete(session);

  const questionText =
    session.currentQuestionText ??
    LEGACY_JS_ENGINEER_QUESTIONS[qIndex] ??
    INITIAL_SYSTEM_DESIGN_QUESTION;

  let transcript = input.transcript?.trim() ?? '';
  if (input.audioBuffer && input.audioBuffer.length > 0) {
    transcript = await transcribeAudio(input.audioBuffer, input.audioFilename ?? 'recording.webm');
  }

  if (!transcript) {
    throw new Error('EMPTY_TRANSCRIPT');
  }

  const nextIndex = qIndex + 1;
  const isLast = nextIndex >= INTERVIEW_MAX_QUESTIONS;
  const previousTurns = await prisma.interviewTurn.findMany({
    where: { sessionId: session.id },
    orderBy: { order: 'asc' },
    select: { questionText: true, transcript: true, score: true },
  });
  const grade = await gradeTurnAndGenerateNext(
    questionText,
    transcript,
    previousTurns,
    !isLast,
    session.resumeContext,
  );

  const currentSession = await loadSessionForUser(sessionId, userId);
  const activeSession = currentSession ? await reconcileMobileMonitor(currentSession) : null;
  if (activeSession?.status !== InterviewSessionStatus.IN_PROGRESS) {
    throw new Error('SESSION_NOT_ACTIVE');
  }
  if (isLast) await assertMobileChecksComplete(activeSession);

  await prisma.interviewTurn.create({
    data: {
      sessionId: session.id,
      order: qIndex,
      questionText,
      transcript,
      score: Math.round(grade.score),
      llmFeedback: JSON.stringify({
        feedback: grade.feedback,
        keyPointsMissing: grade.keyPointsMissing ?? [],
      }),
    },
  });

  if (isLast) {
    const turns = await prisma.interviewTurn.findMany({
      where: { sessionId: session.id },
      orderBy: { order: 'asc' },
      select: { questionText: true, transcript: true, score: true },
    });

    const report = await generateFinalReport(turns, session.resumeContext);

    const summaryPayload = {
      verdict: report.verdict,
      overallScore: report.overallScore,
      dimensions: report.dimensions ?? {},
      weakTopics: report.weakTopics,
      resumeSkillGaps: session.resumeContext ? report.weakTopics : [],
      improvementPlan: report.improvementPlan,
      strengths: report.strengths,
    };

    const updated = await prisma.interviewSession.updateMany({
      where: { id: session.id, status: InterviewSessionStatus.IN_PROGRESS },
      data: {
        status: InterviewSessionStatus.COMPLETED,
        currentQuestion: nextIndex,
        currentQuestionText: null,
        verdict: report.verdict as InterviewVerdict,
        overallScore: Math.round(report.overallScore),
        summaryJson: JSON.stringify(summaryPayload),
        reportDetail: report.detailedMarkdown,
      },
    });
    if (updated.count === 0) throw new Error('SESSION_NOT_ACTIVE');
  } else {
    const updated = await prisma.interviewSession.updateMany({
      where: { id: session.id, status: InterviewSessionStatus.IN_PROGRESS },
      data: {
        currentQuestion: nextIndex,
        currentQuestionText: grade.nextQuestion,
      },
    });
    if (updated.count === 0) throw new Error('SESSION_NOT_ACTIVE');
  }

  const updated = await prisma.interviewSession.findUniqueOrThrow({ where: { id: session.id } });
  return {
    ...sessionPublicState(updated),
    lastTurn: {
      score: Math.round(grade.score),
      feedback: grade.feedback,
      keyPointsMissing: grade.keyPointsMissing ?? [],
    },
    completed: isLast,
  };
}
