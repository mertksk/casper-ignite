import { NextRequest, NextResponse } from "next/server";
import { waitForVaultDeploy } from "@/lib/vault";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

// GET /api/vault/deploy/[hash]/wait
// Waits for a deploy to complete and returns the status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  // Rate limiting
  try {
    await enforceRateLimit(request, "vault-query");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  try {
    const { hash } = await params;
    const searchParams = request.nextUrl.searchParams;
    const timeout = parseInt(searchParams.get("timeout") || "300000", 10);

    // Cap timeout at 5 minutes
    const maxTimeout = Math.min(timeout, 300_000);

    const result = await waitForVaultDeploy(hash, maxTimeout);

    return NextResponse.json({
      confirmed: result.success,
      executed: result.executed,
      error: result.error,
    });
  } catch (error) {
    console.error("[Deploy Wait] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to check deploy status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
