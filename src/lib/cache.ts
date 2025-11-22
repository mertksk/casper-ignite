import "server-only";
import Redis from "ioredis";
import { appConfig } from "./config";

declare global {
  var redis: Redis | undefined;
}

const createRedis = () => {
  if (!appConfig.REDIS_URL) return undefined;
  
  const client = new Redis(appConfig.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableAutoPipelining: true,
    retryStrategy: (times) => {
      if (times > 3) return null; // Stop retrying after 3 attempts
      return Math.min(times * 50, 2000);
    },
  });

  client.on("error", (err) => {
    // Suppress connection errors in dev/test to avoid noise if Redis is missing/misconfigured
    if (appConfig.isDev || appConfig.isTest) {
      console.warn("Redis connection error (suppressed):", err.message);
    } else {
      console.error("Redis connection error:", err);
    }
  });

  return client;
};

export const redis = appConfig.REDIS_URL
  ? global.redis ?? createRedis()
  : undefined;

if (appConfig.REDIS_URL && redis && appConfig.isDev) {
  global.redis = redis;
}

export async function redisGetJson<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  const payload = await redis.get(key);
  if (!payload) return null;
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

export async function redisSetJson<T>(
  key: string,
  value: T,
  ttlSeconds = appConfig.METRICS_CACHE_TTL
): Promise<void> {
  if (!redis) return;
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}
