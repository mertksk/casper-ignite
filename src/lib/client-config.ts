import { z } from "zod";

// This file contains config safe to be exposed to client-side components.
// It should NOT have "server-only" directive.

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Casper Ignite"),
  NEXT_PUBLIC_CHAIN_NAME: z.string().min(1).default("casper-test"),
  NEXT_PUBLIC_PLATFORM_FEE_ADDRESS: z.string().min(1).default("0202a0c94e3f2e9e9f8c0a0a8f8e9d8c7b6a5b4c3d2e1f0a0b1c2d3e4f5a6b7c8d9e"),
  NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS: z.string().min(1).default("0202cd4a869fd31185b63fcd005c226b14b8e9674724c2469c2cfa2456c1219ecf6c"),
});

const publicParsed = publicEnvSchema.safeParse(process.env);

if (!publicParsed.success) {
  console.error("Invalid public environment configuration", publicParsed.error.flatten().fieldErrors);
  throw new Error("Unable to start without valid public environment variables.");
}

export const publicRuntime = {
  appName: publicParsed.data.NEXT_PUBLIC_APP_NAME,
  chainName: publicParsed.data.NEXT_PUBLIC_CHAIN_NAME,
  platformFeeAddress: publicParsed.data.NEXT_PUBLIC_PLATFORM_FEE_ADDRESS,
  liquidityPoolAddress: publicParsed.data.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS,
  platformFeeAmount: 20, // CSPR
  liquidityPoolAmount: 180, // CSPR
  tokenDeploymentGas: 0, // CSPR - platform pays for token deployment
  totalPaymentAmount: 200, // CSPR - total user payment (20 + 180, platform pays deployment)
};