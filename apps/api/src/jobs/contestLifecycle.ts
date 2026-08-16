import { prisma, ContestStatus, ContestKind, SubmissionStatus } from '@codeforces/db';
import { determineStatus } from '../utils/contestRules';
import { finalizeContestLeaderboard } from '../services/leaderboardService';

const INTERVAL_MS = Number(process.env.CONTEST_LIFECYCLE_INTERVAL_MS || 30_000);
const PENDING_MS = Number(process.env.JUDGE_PENDING_TIMEOUT_MS || 10 * 60 * 1000);
const LOCK_KEY_1 = 87201;
const LOCK_KEY_2 = 1;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tryAdvisoryLock<T>(fn: () => Promise<T>): Promise<T | null> {
  return prisma.$transaction(
    async (tx) => {
      // Two-arg form is (int, int). Prisma binds JS numbers as bigint.
      const rows = await tx.$queryRaw<Array<{ pg_try_advisory_xact_lock: boolean }>>`
        SELECT pg_try_advisory_xact_lock((${LOCK_KEY_1})::int, (${LOCK_KEY_2})::int)
      `;
      if (!rows[0]?.pg_try_advisory_xact_lock) {
        return null;
      }
      return fn();
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

export async function reapStaleSubmissions(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - PENDING_MS);
  const result = await prisma.submission.updateMany({
    where: {
      status: SubmissionStatus.PENDING,
      submittedAt: { lt: cutoff },
    },
    data: {
      status: SubmissionStatus.RUNTIME_ERROR,
      aiResponse: 'Judge timed out before producing a result.',
      hintText: 'Judge timed out before producing a result.',
      resultJson: JSON.stringify({
        status: 'RUNTIME_ERROR',
        feedback: 'Judge timed out before producing a result.',
      }),
    },
  });
  if (result.count > 0) {
    console.log(`[judge-reaper] marked ${result.count} stale PENDING submission(s) as RUNTIME_ERROR`);
  }
  return result.count;
}

/**
 * Transitions contest status by wall clock and finalizes leaderboards when contests end.
 * Idempotent: only acts when stored status differs from effective status.
 */
export async function runContestLifecycleTick(now = new Date()): Promise<{
  flipped: number;
  finalized: number;
  reaped: number;
}> {
  if (running) return { flipped: 0, finalized: 0, reaped: 0 };
  running = true;

  try {
    const outcome = await tryAdvisoryLock(async () => {
      let flipped = 0;
      let finalized = 0;

      const contests = await prisma.contest.findMany({
        where: {
          kind: { not: ContestKind.PRACTICE },
          status: { not: ContestStatus.ENDED },
        },
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
          status: true,
        },
      });

      for (const contest of contests) {
        const next = determineStatus(contest.startTime, contest.endTime, now);
        if (next === contest.status) continue;

        const updated = await prisma.contest.updateMany({
          where: { id: contest.id, status: contest.status },
          data: { status: next },
        });
        if (updated.count !== 1) continue;

        flipped += 1;
        console.log(
          `[contest-lifecycle] ${contest.name} (${contest.id}): ${contest.status} → ${next}`,
        );

        if (next === ContestStatus.ENDED) {
          try {
            await finalizeContestLeaderboard(contest.id);
            finalized += 1;
            console.log(`[contest-lifecycle] Finalized leaderboard for ${contest.id}`);
          } catch (err) {
            console.error(`[contest-lifecycle] Finalize failed for ${contest.id}:`, err);
          }
        }
      }

      const reaped = await reapStaleSubmissions(now);
      return { flipped, finalized, reaped };
    });

    return outcome ?? { flipped: 0, finalized: 0, reaped: 0 };
  } finally {
    running = false;
  }
}

export function startContestLifecycleJob(): void {
  if (timer) return;

  setTimeout(() => {
    runContestLifecycleTick().catch((err) =>
      console.error('[contest-lifecycle] initial tick failed:', err),
    );
  }, 2_000);

  timer = setInterval(() => {
    runContestLifecycleTick().catch((err) =>
      console.error('[contest-lifecycle] tick failed:', err),
    );
  }, INTERVAL_MS);

  if (typeof timer.unref === 'function') timer.unref();
  console.log(`[contest-lifecycle] started (every ${INTERVAL_MS}ms)`);
}

export function stopContestLifecycleJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
