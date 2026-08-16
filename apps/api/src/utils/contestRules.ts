import { ContestStatus } from '@codeforces/db';

export function determineStatus(startTime: Date, endTime: Date, now = new Date()): ContestStatus {
  if (now < startTime) return ContestStatus.UPCOMING;
  if (now > endTime) return ContestStatus.ENDED;
  return ContestStatus.LIVE;
}

export function contestRequiresRegistration(kind: string): boolean {
  return kind !== 'PRACTICE';
}

export function canRegisterForContest(opts: {
  kind: string;
  startTime: Date;
  endTime: Date;
  isPublished: boolean;
  now?: Date;
}): boolean {
  if (!opts.isPublished) return false;
  if (!contestRequiresRegistration(opts.kind)) return false;
  const now = opts.now ?? new Date();
  return now < opts.endTime;
}

export function canUnregisterFromContest(opts: {
  kind: string;
  startTime: Date;
  now?: Date;
}): boolean {
  if (!contestRequiresRegistration(opts.kind)) return false;
  const now = opts.now ?? new Date();
  return now < opts.startTime;
}

export type ContestSubmitDecision = {
  allowed: boolean;
  /** True only while the contest is LIVE and the user is registered (or PRACTICE catalog). */
  countsForLeaderboard: boolean;
  /** practice = always-on catalog; contest = live rated/unrated; post_contest = after end, no standings */
  mode: 'practice' | 'contest' | 'post_contest' | 'blocked';
  code?: 'NOT_STARTED' | 'NOT_REGISTERED' | 'NOT_PUBLISHED';
  message?: string;
};

/**
 * Production contest submit policy:
 * - PRACTICE catalog: always allowed, never on contest leaderboard
 * - LIVE + registered: allowed, counts for leaderboard
 * - ENDED: allowed for practice (no leaderboard) — Codeforces-style virtual practice
 * - UPCOMING: blocked until start
 * - LIVE + not registered: blocked
 */
export function evaluateContestSubmit(opts: {
  kind: string;
  startTime: Date;
  endTime: Date;
  isRegistered: boolean;
  isPublished?: boolean;
  now?: Date;
}): ContestSubmitDecision {
  const now = opts.now ?? new Date();

  if (opts.kind === 'PRACTICE') {
    return { allowed: true, countsForLeaderboard: false, mode: 'practice' };
  }

  if (opts.isPublished === false) {
    return {
      allowed: false,
      countsForLeaderboard: false,
      mode: 'blocked',
      code: 'NOT_PUBLISHED',
      message: 'This contest is not published',
    };
  }

  if (now < opts.startTime) {
    return {
      allowed: false,
      countsForLeaderboard: false,
      mode: 'blocked',
      code: 'NOT_STARTED',
      message: 'Contest has not started yet',
    };
  }

  if (now > opts.endTime) {
    return { allowed: true, countsForLeaderboard: false, mode: 'post_contest' };
  }

  // LIVE window
  if (!opts.isRegistered) {
    return {
      allowed: false,
      countsForLeaderboard: false,
      mode: 'blocked',
      code: 'NOT_REGISTERED',
      message: 'Register for this contest before submitting',
    };
  }

  return { allowed: true, countsForLeaderboard: true, mode: 'contest' };
}

export function canSubmitToContest(opts: {
  kind: string;
  startTime: Date;
  endTime: Date;
  isRegistered: boolean;
  isPublished?: boolean;
  now?: Date;
}): boolean {
  return evaluateContestSubmit(opts).allowed;
}

/** Whether problem statements may be shown for this contest. */
export function canViewContestProblems(opts: {
  kind: string;
  startTime: Date;
  endTime: Date;
  now?: Date;
}): boolean {
  if (opts.kind === 'PRACTICE') return true;
  const now = opts.now ?? new Date();
  return now >= opts.startTime;
}
