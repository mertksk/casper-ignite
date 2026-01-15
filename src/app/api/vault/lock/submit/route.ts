
import { NextRequest, NextResponse } from "next/server";
import { DeployUtil, CLPublicKey } from "casper-js-sdk";
import { appConfig } from "@/lib/config";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

// POST /api/vault/lock/submit
// Submits a signed lock_cspr deploy to the network
export async function POST(request: NextRequest) {
  // Rate limiting
  try {
    await enforceRateLimit(request, "vault-lock");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  try {
    const body = await request.json();
    const { deployJson, signatureHex, signerPublicKey } = body;

    if (!deployJson || !signatureHex || !signerPublicKey) {
      return NextResponse.json(
        { error: "Missing required fields: deployJson, signatureHex, signerPublicKey" },
        { status: 400 }
      );
    }

    // Reconstruct the deploy from JSON
    const deployResult = DeployUtil.deployFromJson(deployJson);
    if (deployResult.err) {
      return NextResponse.json(
        { error: "Invalid deploy JSON: " + deployResult.val.message },
        { status: 400 }
      );
    }
    const deploy = deployResult.val;

    // Add the signature to the deploy
    const publicKey = CLPublicKey.fromHex(signerPublicKey);
    const rawSignatureBytes = new Uint8Array(
      (signatureHex.match(/.{2}/g) || []).map((byte: string) => parseInt(byte, 16))
    );

    // Check if rawSignatureBytes includes tag via length heuristic
    let signatureBytes: Uint8Array;
    if (rawSignatureBytes.length === 64) {
      const algoTag = publicKey.isEd25519() ? 1 : 2;
      signatureBytes = new Uint8Array(rawSignatureBytes.length + 1);
      signatureBytes[0] = algoTag;
      signatureBytes.set(rawSignatureBytes, 1);
    } else {
      signatureBytes = rawSignatureBytes;
    }

    const signedDeploy = DeployUtil.setSignature(deploy, signatureBytes, publicKey);

    // Submit the deploy to the network
    const rpcUrl = appConfig.rpcUrls.primary;

    const submitResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "account_put_deploy",
        params: {
          deploy: DeployUtil.deployToJson(signedDeploy),
        },
      }),
    });

    const submitResult = await submitResponse.json();

    if (submitResult.error) {
      console.error("[Vault Lock] Deploy submission failed:", submitResult.error);
      return NextResponse.json(
        { error: submitResult.error.message || "Deploy submission failed" },
        { status: 500 }
      );
    }

    const deployHash = submitResult.result?.deploy_hash || Buffer.from(signedDeploy.hash).toString("hex");

    console.log(`[Vault Lock] Deploy submitted: ${deployHash}`);

    return NextResponse.json({
      success: true,
      deployHash,
      message: "Lock deploy submitted successfully",
    });
  } catch (error) {
    console.error("[Vault Lock] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to submit lock deploy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
