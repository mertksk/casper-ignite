import { NextRequest, NextResponse } from "next/server";
import { DeployUtil, CLPublicKey } from "casper-js-sdk";
import { appConfig } from "@/lib/config";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

// POST /api/amm/trade/submit
// Submits a signed AMM trade deploy to the network
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, "amm-trade");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  try {
    const body = await request.json();
    const { deployJson, signatureHex, signerPublicKey, tradeType } = body;

    if (!deployJson || !signatureHex || !signerPublicKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    // Add the signature
    const publicKey = CLPublicKey.fromHex(signerPublicKey);

    // Parse raw signature bytes from wallet
    const rawSignatureBytes = new Uint8Array(
      (signatureHex.match(/.{2}/g) || []).map((byte: string) => parseInt(byte, 16))
    );

    // Determine algorithm tag from public key (01 = Ed25519, 02 = Secp256k1)
    // CLPublicKey has tag built-in, but we need to check if signature has it.
    // Wallet usually returns raw sig (64 bytes).
    // Casper signatures need tag prefix.

    // Check if rawSignatureBytes includes tag
    let signatureBytes: Uint8Array;

    // Simple heuristic: if length is 64, it's raw. If 65, it likely has tag.
    if (rawSignatureBytes.length === 64) {
      // Add algorithm tag to signature
      const algoTag = publicKey.isEd25519() ? 1 : 2;
      signatureBytes = new Uint8Array(rawSignatureBytes.length + 1);
      signatureBytes[0] = algoTag;
      signatureBytes.set(rawSignatureBytes, 1);
    } else {
      signatureBytes = rawSignatureBytes;
    }

    const signedDeploy = DeployUtil.setSignature(deploy, signatureBytes, publicKey);

    // Submit to network
    const rpcUrl = appConfig.rpcUrls.primary;

    // We can use sendSignedDeploy from lib/casper-client but that's client-side or similar.
    // Or just RPC fetch.

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
      console.error(`[AMM ${tradeType}] Deploy submission failed:`, submitResult.error);
      return NextResponse.json(
        { error: submitResult.error.message || "Deploy submission failed" },
        { status: 500 }
      );
    }

    const deployHash = submitResult.result?.deploy_hash || Buffer.from(signedDeploy.hash).toString('hex');

    console.log(`[AMM ${tradeType}] Deploy submitted: ${deployHash}`);

    return NextResponse.json({
      success: true,
      deployHash,
      tradeType,
      message: `${tradeType} order submitted successfully`,
    });
  } catch (error) {
    console.error("[AMM Trade] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to submit trade";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
