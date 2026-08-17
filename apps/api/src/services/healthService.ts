import { prisma } from '@codeforces/db';
import {
  isDockerJudgeAvailable,
  isJudgeRequiredForReady,
} from './dockerJudgeService';
import { isRedisUrlConfigured, pingRedis } from './redisService';

export type ReadyChecks = {
  postgres: boolean;
  redis: boolean | null;
  docker: boolean | null;
};

export async function getReadyStatus(): Promise<{
  ready: boolean;
  checks: ReadyChecks;
}> {
  const checks: ReadyChecks = {
    postgres: false,
    redis: null,
    docker: null,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = true;
  } catch {
    checks.postgres = false;
  }

  if (isRedisUrlConfigured()) {
    checks.redis = await pingRedis();
  }

  // Always probe Docker for operators; only fail readiness when judge is required.
  checks.docker = await isDockerJudgeAvailable();

  const dockerOk = !isJudgeRequiredForReady() || checks.docker === true;
  const ready = checks.postgres && checks.redis !== false && dockerOk;

  return { ready, checks };
}
