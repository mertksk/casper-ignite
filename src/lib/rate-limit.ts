import "server-only";
import { NextRequest } from "next/server";
import { redis } from "./cache";
import { appConfig } from "./config";

class RateLimitError extends Error {
  status = 429;
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

const memoryStore = new Map<
  string,
  { hits: number; expiresAt: number }
>();

export function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for") ??
    request.ip ??
    request.headers.get("cf-connecting-ip") ??
    "anonymous"
  );
}

export async function enforceRateLimit(request: NextRequest, bucket = "global") {
  const identifier = `${bucket}:${getClientIp(request)}`;
  const windowMs = appConfig.RATE_LIMIT_WINDOW_MS;
  const max = appConfig.RATE_LIMIT_MAX;

  if (redis) {
    const ttlSeconds = Math.ceil(windowMs / 1000);
    const tx = redis.multi();
    tx.incr(identifier);
    tx.expire(identifier, ttlSeconds);
    const [countResult] = (await tx.exec()) ?? [];
    const count = Array.isArray(countResult) ? Number(countResult[1]) : Number(countResult);
    if (count > max) {
      throw new RateLimitError("Çok fazla istek alındı. Lütfen biraz sonra tekrar deneyin.");
    }
    return;
  }

  const now = Date.now();
  const bucketState = memoryStore.get(identifier);
  if (!bucketState || bucketState.expiresAt < now) {
    memoryStore.set(identifier, { hits: 1, expiresAt: now + windowMs });
    return;
  }

  bucketState.hits += 1;
  if (bucketState.hits > max) {
    throw new RateLimitError("Çok fazla istek alındı. Lütfen biraz sonra tekrar deneyin.");
  }
}

export { RateLimitError };
