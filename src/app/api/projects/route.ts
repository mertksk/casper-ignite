import { appConfig } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";
import { projectService } from "@/server/services/project-service";
import { projectCreateSchema } from "@/lib/dto";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { checkDeployStatus } from "@/lib/casper";

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  try {
    const data = await projectService.list(searchParams);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "An error occurred while listing projects." }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, "project-create");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = projectCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verify payment deploys (platform deploys token, so user only pays 2 fees)
  const { platformFeeHash, liquidityPoolHash } = parsed.data;

  // In development, payment verification can be skipped
  const requirePaymentVerification = !appConfig.isDev;

  if (requirePaymentVerification) {
    if (!platformFeeHash || !liquidityPoolHash) {
      return NextResponse.json(
        { error: `Payment verification required. Please complete both payments: platform fee (${appConfig.paymentAmounts.platformFee} CSPR) and liquidity pool (${appConfig.paymentAmounts.liquidityPool} CSPR). Total: ${appConfig.paymentAmounts.total} CSPR` },
        { status: 400 }
      );
    }

    try {
      // Verify platform fee payment (20 CSPR)
      console.log("[Project API] Verifying platform fee payment:", platformFeeHash);
      const feeStatus = await checkDeployStatus(platformFeeHash);
      console.log("[Project API] Platform fee status:", JSON.stringify(feeStatus));

      if (!feeStatus.executed || !feeStatus.success) {
        return NextResponse.json(
          { error: "Platform fee payment not confirmed on blockchain. Please wait for confirmation.", details: feeStatus },
          { status: 400 }
        );
      }

      // Verify liquidity pool payment (180 CSPR)
      console.log("[Project API] Verifying liquidity pool payment:", liquidityPoolHash);
      const liquidityStatus = await checkDeployStatus(liquidityPoolHash);
      console.log("[Project API] Liquidity pool status:", JSON.stringify(liquidityStatus));

      if (!liquidityStatus.executed || !liquidityStatus.success) {
        return NextResponse.json(
          { error: "Liquidity pool payment not confirmed on blockchain. Please wait for confirmation.", details: liquidityStatus },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error("Payment verification error:", error);
      return NextResponse.json(
        { error: "Failed to verify payments. Please try again later." },
        { status: 500 }
      );
    }
  }

  try {
    const project = await projectService.createProject(parsed.data);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Project creation failed:", error);
    const message = error instanceof Error ? error.message : "Failed to create project.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
