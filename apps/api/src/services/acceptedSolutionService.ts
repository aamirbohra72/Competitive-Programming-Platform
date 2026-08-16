import { prisma, SubmissionStatus } from '@codeforces/db';
import { randomUUID } from 'node:crypto';

export type SaveAcceptedInput = {
  userId: string;
  challengeId: string;
  submissionId: string;
  language: string;
  sourceCode: string;
  score: number;
};

export type AcceptedSolutionRow = {
  id: string;
  userId: string;
  challengeId: string;
  submissionId: string;
  language: string;
  sourceCode: string;
  score: number;
  firstAcceptedAt: Date;
  updatedAt: Date;
};

/**
 * Persist the user's accepted solution for a challenge.
 * Idempotent: keeps firstAcceptedAt; replaces stored code when score is equal or better.
 */
export async function saveAcceptedSolution(
  input: SaveAcceptedInput,
): Promise<AcceptedSolutionRow> {
  const rows = await prisma.$queryRaw<AcceptedSolutionRow[]>`
    SELECT * FROM "AcceptedSolution"
    WHERE "userId" = ${input.userId} AND "challengeId" = ${input.challengeId}
    LIMIT 1
  `;
  const existing = rows[0];

  if (!existing) {
    const id = randomUUID();
    const now = new Date();
    await prisma.$executeRaw`
      INSERT INTO "AcceptedSolution"
        ("id", "userId", "challengeId", "submissionId", "language", "sourceCode", "score", "firstAcceptedAt", "updatedAt")
      VALUES
        (${id}, ${input.userId}, ${input.challengeId}, ${input.submissionId}, ${input.language}, ${input.sourceCode}, ${input.score}, ${now}, ${now})
      ON CONFLICT ("userId", "challengeId") DO NOTHING
    `;
    const created = await prisma.$queryRaw<AcceptedSolutionRow[]>`
      SELECT * FROM "AcceptedSolution"
      WHERE "userId" = ${input.userId} AND "challengeId" = ${input.challengeId}
      LIMIT 1
    `;
    return created[0]!;
  }

  if (input.score < existing.score) {
    return existing;
  }

  const now = new Date();
  await prisma.$executeRaw`
    UPDATE "AcceptedSolution"
    SET
      "submissionId" = ${input.submissionId},
      "language" = ${input.language},
      "sourceCode" = ${input.sourceCode},
      "score" = ${input.score},
      "updatedAt" = ${now}
    WHERE "id" = ${existing.id}
  `;

  return {
    ...existing,
    submissionId: input.submissionId,
    language: input.language,
    sourceCode: input.sourceCode,
    score: input.score,
    updatedAt: now,
  };
}

/**
 * Load accepted solution; if missing, backfill from latest ACCEPTED submission.
 */
export async function getAcceptedSolutionForUser(
  userId: string,
  challengeId: string,
): Promise<AcceptedSolutionRow | null> {
  const rows = await prisma.$queryRaw<AcceptedSolutionRow[]>`
    SELECT * FROM "AcceptedSolution"
    WHERE "userId" = ${userId} AND "challengeId" = ${challengeId}
    LIMIT 1
  `;
  if (rows[0]) return rows[0];

  const best = await prisma.submission.findFirst({
    where: {
      userId,
      challengeId,
      status: SubmissionStatus.ACCEPTED,
    },
    orderBy: [{ score: 'desc' }, { submittedAt: 'desc' }],
  });
  if (!best) return null;

  return saveAcceptedSolution({
    userId,
    challengeId,
    submissionId: best.id,
    language: best.language,
    sourceCode: best.sourceCode,
    score: best.score,
  });
}

export async function userHasAccepted(userId: string, challengeId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "AcceptedSolution"
    WHERE "userId" = ${userId} AND "challengeId" = ${challengeId}
    LIMIT 1
  `;
  if (rows[0]) return true;
  const count = await prisma.submission.count({
    where: { userId, challengeId, status: SubmissionStatus.ACCEPTED },
  });
  return count > 0;
}
