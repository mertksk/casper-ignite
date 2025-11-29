import { NextRequest, NextResponse } from "next/server";

// POST /api/vault/unlock
// Admin endpoint to unlock CSPR from vault
// NOTE: This requires session WASM deployment which is not yet implemented
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Not implemented",
      message:
        "Vault unlock requires session WASM deployment. " +
        "This will be implemented in the next phase. " +
        "For now, use casper-client directly with the vault contract.",
    },
    { status: 501 }
  );
}
