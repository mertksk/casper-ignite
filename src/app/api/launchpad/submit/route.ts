import { NextRequest, NextResponse } from "next/server";
import { Deploy, PublicKey } from "casper-js-sdk";

const NODE_URL = process.env.CSPR_RPC_URL_PRIMARY || "https://node.testnet.casper.network/rpc";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deployJson, signatureHex, signerPublicKey, action } = body;

    if (!deployJson || !signatureHex || !signerPublicKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Reconstruct the deploy with signature
    const deploy = Deploy.fromJSON(deployJson);
    const publicKey = PublicKey.fromHex(signerPublicKey);
    const signatureBytes = new Uint8Array(
      (signatureHex.match(/.{2}/g) || []).map((byte: string) => parseInt(byte, 16))
    );

    const signedDeploy = Deploy.setSignature(deploy, signatureBytes, publicKey);

    // Submit to network
    const response = await fetch(NODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "account_put_deploy",
        params: {
          deploy: Deploy.toJSON(signedDeploy),
        },
      }),
    });

    const result = await response.json();

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message || "Deploy failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deployHash: signedDeploy.hash.toHex(),
      action,
      explorerUrl: `https://testnet.cspr.live/deploy/${signedDeploy.hash.toHex()}`,
    });
  } catch (error) {
    console.error("Error submitting launchpad deploy:", error);
    return NextResponse.json(
      { error: "Failed to submit deploy" },
      { status: 500 }
    );
  }
}
