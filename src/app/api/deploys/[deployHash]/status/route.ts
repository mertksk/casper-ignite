import { NextRequest, NextResponse } from "next/server";
import { checkDeployStatus } from "@/lib/casper";

/**
 * GET /api/deploys/[deployHash]/status
 * Check the status of a deploy on the blockchain
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deployHash: string }> }
) {
  try {
    const { deployHash } = await params;
    const status = await checkDeployStatus(deployHash);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Error checking deploy status:", error);
    return NextResponse.json(
      { executed: false, success: false, error: "Failed to check deploy status" },
      { status: 500 }
    );
  }
}
