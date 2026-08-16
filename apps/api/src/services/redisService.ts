import { createClient, type RedisClientType } from 'redis';

/** Prefer IPv4 — on Windows `localhost` often resolves to ::1 and fails if Redis only binds 127.0.0.1 */
const REDIS_URL = process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379';

let redisClient: RedisClientType | null = null;
let isConnected = false;
let connectAttempted = false;
let errorLogged = false;

function getClient(): RedisClientType {
  if (!redisClient) {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          // Stop hammering when Redis is down (dev without Redis is fine)
          if (retries > 3) {
            return false;
          }
          return Math.min(retries * 200, 1000);
        },
        connectTimeout: 3000,
      },
    });

    redisClient.on('error', (err) => {
      // Log once — avoid flooding the terminal
      if (!errorLogged) {
        errorLogged = true;
        console.warn(
          `⚠️  Redis unavailable (${REDIS_URL}): ${err instanceof Error ? err.message : String(err)}`,
        );
        console.warn('⚠️  Continuing without Redis (cache/leaderboard limited)');
      }
    });
  }
  return redisClient;
}

export async function connectRedis(): Promise<void> {
  if (isConnected || connectAttempted) return;
  connectAttempted = true;

  try {
    const client = getClient();
    await client.connect();
    isConnected = true;
    errorLogged = false;
    console.log(`✅ Redis connected (${REDIS_URL})`);
  } catch (error) {
    isConnected = false;
    if (!errorLogged) {
      errorLogged = true;
      console.warn(
        `⚠️  Failed to connect to Redis (${REDIS_URL}):`,
        error instanceof Error ? error.message : error,
      );
      console.warn('⚠️  Continuing without Redis (cache/leaderboard limited)');
    }
  }
}

export function isRedisUrlConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

export async function pingRedis(): Promise<boolean> {
  if (!isConnected || !redisClient) return false;
  try {
    await redisClient.ping();
    return true;
  } catch {
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (!redisClient || !isConnected) return;
  try {
    await redisClient.quit();
    isConnected = false;
  } catch (error) {
    console.error('Error disconnecting Redis:', error);
  }
}

export async function addToLeaderboard(
  contestId: string,
  userId: string,
  score: number,
): Promise<void> {
  if (!isConnected || !redisClient) return;
  try {
    const key = `leaderboard:${contestId}`;
    await redisClient.zAdd(key, {
      score,
      value: userId,
    });
  } catch (error) {
    console.error('Redis error:', error);
  }
}

export async function getLeaderboard(
  contestId: string,
  limit: number = 100,
): Promise<Array<{ userId: string; score: number; rank: number }>> {
  if (!isConnected || !redisClient) return [];
  try {
    const key = `leaderboard:${contestId}`;
    const results = await redisClient.zRangeWithScores(key, 0, limit - 1, {
      REV: true,
    });

    return results.map((result, index) => ({
      userId: result.value,
      score: result.score,
      rank: index + 1,
    }));
  } catch (error) {
    console.error('Redis error:', error);
    return [];
  }
}

export async function getUserRank(contestId: string, userId: string): Promise<number | null> {
  if (!isConnected || !redisClient) return null;
  try {
    const key = `leaderboard:${contestId}`;
    const rank = await redisClient.zRevRank(key, userId);
    return rank !== null ? rank + 1 : null;
  } catch (error) {
    console.error('Redis error:', error);
    return null;
  }
}

export async function clearLeaderboard(contestId: string): Promise<void> {
  if (!isConnected || !redisClient) return;
  try {
    const key = `leaderboard:${contestId}`;
    await redisClient.del(key);
  } catch (error) {
    console.error('Redis error:', error);
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  if (!isConnected || !redisClient) return null;
  try {
    return await redisClient.get(key);
  } catch (error) {
    console.error('Redis cacheGet error:', error);
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!isConnected || !redisClient) return;
  try {
    await redisClient.set(key, value, { EX: ttlSeconds });
  } catch (error) {
    console.error('Redis cacheSet error:', error);
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!isConnected || !redisClient) return;
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('Redis cacheDel error:', error);
  }
}

export { redisClient };
