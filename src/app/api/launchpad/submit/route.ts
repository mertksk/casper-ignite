import { NextRequest, NextResponse } from "next/server";
import { DeployUtil, CLPublicKey } from "casper-js-sdk";

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
    const deployResult = DeployUtil.deployFromJson(deployJson);
    if (deployResult.err) {
      return NextResponse.json(
        { error: "Invalid deploy JSON: " + deployResult.val.message },
        { status: 400 }
      );
    }
    const deploy = deployResult.val;

    const publicKey = CLPublicKey.fromHex(signerPublicKey);

    // Parse raw signature bytes from wallet
    const rawSignatureBytes = new Uint8Array(
      (signatureHex.match(/.{2}/g) || []).map((byte: string) => parseInt(byte, 16))
    );

    // Determine algorithm tag from public key (01 = Ed25519, 02 = Secp256k1)
    // Wallet usually returns raw sig (64 bytes).

    // Check if rawSignatureBytes includes tag via length guess
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

    // Submit to network
    const response = await fetch(NODE_URL, {
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

    const result = await response.json();

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message || "Deploy failed" },
        { status: 500 }
      );
    }

    const deployHash = result.result?.deploy_hash || Buffer.from(signedDeploy.hash).toString("hex");

    return NextResponse.json({
      success: true,
      deployHash: deployHash,
      action,
      explorerUrl: `https://testnet.cspr.live/deploy/${deployHash}`,
    });
  } catch (error) {
    console.error("Error submitting launchpad deploy:", error);
    return NextResponse.json(
      { error: "Failed to submit deploy" },
      { status: 500 }
    );
  }
}
