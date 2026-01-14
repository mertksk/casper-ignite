// import "server-only";
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Casper Ignite"),
  NEXT_PUBLIC_CHAIN_NAME: z.string().min(1).default("casper-test"),
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
  PLATFORM_FEE_ADDRESS: z.string().min(1).default("0202a0c94e3f2e9e9f8c0a0a8f8e9d8c7b6a5b4c3d2e1f0a0b1c2d3e4f5a6b7c8d9e"),
  LIQUIDITY_POOL_ADDRESS: z.string().min(1).default("0202cd4a869fd31185b63fcd005c226b14b8e9674724c2469c2cfa2456c1219ecf6c"),
  PLATFORM_TOKEN_WALLET_ADDRESS: z.string().min(1).default("01252f367c8cfe14bf796a6ad298d9ad7a8d2eb22907e047b37e6bbb76d7b636b2"),
  PLATFORM_TOKEN_WALLET_PRIVATE_KEY_HEX: z.string().optional(),
  PLATFORM_TOKEN_WALLET_KEY_ALGO: z.enum(["ed25519", "secp256k1"]).default("ed25519"),
  // Token Vault Contract Configuration
  VAULT_CONTRACT_ACCOUNT_HASH: z.string().optional(),
  VAULT_CONTRACT_HASH: z.string().optional(), // Contract hash for calling entry points
  VAULT_ADMIN_PRIVATE_KEY_HEX: z.string().optional(),
  VAULT_ADMIN_KEY_ALGO: z.enum(["ed25519", "secp256k1"]).default("ed25519"),
  // AMM Contract Configuration
  AMM_CONTRACT_HASH: z.string().optional(),
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
  platformAddresses: {
    fee: parsed.data.PLATFORM_FEE_ADDRESS,
    liquidity: parsed.data.LIQUIDITY_POOL_ADDRESS,
    tokenWallet: parsed.data.PLATFORM_TOKEN_WALLET_ADDRESS,
  },
  platformTokenWallet: {
    address: parsed.data.PLATFORM_TOKEN_WALLET_ADDRESS,
    privateKeyHex: parsed.data.PLATFORM_TOKEN_WALLET_PRIVATE_KEY_HEX,
    keyAlgo: parsed.data.PLATFORM_TOKEN_WALLET_KEY_ALGO,
  },
  vault: {
    accountHash: parsed.data.VAULT_CONTRACT_ACCOUNT_HASH,
    contractHash: parsed.data.VAULT_CONTRACT_HASH,
    adminPrivateKeyHex: parsed.data.VAULT_ADMIN_PRIVATE_KEY_HEX,
    adminKeyAlgo: parsed.data.VAULT_ADMIN_KEY_ALGO,
  },
  amm: {
    contractHash: parsed.data.AMM_CONTRACT_HASH,
  },
  paymentAmounts: {
    platformFee: 20, // CSPR - goes to platform
    liquidityPool: 180, // CSPR - goes to platform wallet (used for bonding curve reserves)
    tokenDeployment: 0, // CSPR - platform pays gas for token deployment (not user)
    total: 200, // CSPR - total user payment (20 + 180, platform pays deployment)
  },
} as const;

