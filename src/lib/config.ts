import "server-only";
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Casper Ignite"),
  NEXT_PUBLIC_CHAIN_NAME: z.string().min(1).default("casper-mainnet"),
  CSPR_RPC_URL_PRIMARY: z.string().url(),
  CSPR_RPC_URL_FALLBACK: z.string().url().optional(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().optional(),
  SMTP_URL: z.string().optional(),
  METRICS_CACHE_TTL: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  INDEXER_POLL_INTERVAL_SEC: z.coerce.number().int().positive().default(300),
  INDEXER_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(25),
});

const parsed = envSchema.safeParse({
  ...process.env,
});

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Unable to start without valid environment variables.");
}

export const appConfig = {
  ...parsed.data,
  isDev: parsed.data.NODE_ENV === "development",
  isTest: parsed.data.NODE_ENV === "test",
  rpcUrls: {
    primary: parsed.data.CSPR_RPC_URL_PRIMARY,
    fallback: parsed.data.CSPR_RPC_URL_FALLBACK ?? parsed.data.CSPR_RPC_URL_PRIMARY,
  },
} as const;

export type AppConfig = typeof appConfig;

export const publicRuntime = {
  appName: parsed.data.NEXT_PUBLIC_APP_NAME,
  chainName: parsed.data.NEXT_PUBLIC_CHAIN_NAME,
};
