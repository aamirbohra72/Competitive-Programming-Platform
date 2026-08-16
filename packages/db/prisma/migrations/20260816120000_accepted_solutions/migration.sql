-- AcceptedSolution: one canonical AC solution per user+challenge
CREATE TABLE IF NOT EXISTS "AcceptedSolution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 100,
    "firstAcceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AcceptedSolution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AcceptedSolution_submissionId_key" ON "AcceptedSolution"("submissionId");
CREATE UNIQUE INDEX IF NOT EXISTS "AcceptedSolution_userId_challengeId_key" ON "AcceptedSolution"("userId", "challengeId");
CREATE INDEX IF NOT EXISTS "AcceptedSolution_userId_idx" ON "AcceptedSolution"("userId");
CREATE INDEX IF NOT EXISTS "AcceptedSolution_challengeId_idx" ON "AcceptedSolution"("challengeId");
CREATE INDEX IF NOT EXISTS "AcceptedSolution_firstAcceptedAt_idx" ON "AcceptedSolution"("firstAcceptedAt");

DO $$ BEGIN
  ALTER TABLE "AcceptedSolution" ADD CONSTRAINT "AcceptedSolution_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AcceptedSolution" ADD CONSTRAINT "AcceptedSolution_challengeId_fkey"
    FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AcceptedSolution" ADD CONSTRAINT "AcceptedSolution_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Backfill from existing ACCEPTED submissions (best score, then latest)
INSERT INTO "AcceptedSolution" ("id", "userId", "challengeId", "submissionId", "language", "sourceCode", "score", "firstAcceptedAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  s."userId",
  s."challengeId",
  s."id",
  s."language",
  s."sourceCode",
  s."score",
  s."submittedAt",
  s."updatedAt"
FROM "Submission" s
INNER JOIN (
  SELECT DISTINCT ON ("userId", "challengeId")
    "id"
  FROM "Submission"
  WHERE "status" = 'ACCEPTED'
  ORDER BY "userId", "challengeId", "score" DESC, "submittedAt" DESC
) best ON best."id" = s."id"
ON CONFLICT ("userId", "challengeId") DO NOTHING;
