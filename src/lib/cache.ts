import "server-only";
import Redis from "ioredis";
import { appConfig } from "./config";

declare global {
  var redis: Redis | undefined;
}

const createRedis = () =>
  appConfig.REDIS_URL
    ? new Redis(appConfig.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableAutoPipelining: true,
      })
    : undefined;

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
