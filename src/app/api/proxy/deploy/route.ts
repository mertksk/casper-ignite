
import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
// Removed unused/invalid SDK v2 imports. RpcClient/HttpHandler/Deploy are not used in valid code path or valid in SDK v2 this way.
// If needed, use CasperServiceByJsonRPC

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        let { deploy: deployJson, signatureHex } = body;

        // SDK v2 deployToJson returns { deploy: { ... } }
        // If the client sent the raw result of deployToJson, we need to unwrap it.
        if (deployJson && typeof deployJson === 'object' && 'deploy' in deployJson) {
            console.log("[Proxy] Unwrapping SDK v2 deploy object");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            deployJson = (deployJson as any).deploy;
        }

        if (!deployJson) {
            return NextResponse.json({ error: "Missing deploy JSON" }, { status: 400 });
        }

        console.log(`[Proxy] Received deploy submission`);
        if (deployJson && typeof deployJson === 'object') {
            console.log(`[Proxy] Deploy keys: ${Object.keys(deployJson).join(', ')}`);
            if ('header' in deployJson) {
                console.log(`[Proxy] Header keys: ${Object.keys(deployJson.header).join(', ')}`);
                console.log(`[Proxy] Header content:`, JSON.stringify(deployJson.header, null, 2));
            } else {
                console.log(`[Proxy] Header MISSING in deployJson`);
            }
        } else {
            console.log(`[Proxy] deployJson is not an object:`, typeof deployJson);
        }

        // Ensure approvals array exists and add approval
        const deployWithApproval = { ...deployJson };
        if (!deployWithApproval.approvals) {
            deployWithApproval.approvals = [];
        }

        // Helper to fix signature format - Casper RPC expects signature to have algorithm prefix
        // Ed25519 keys start with '01', Secp256k1 keys start with '02'
        // The signature should have the same prefix
        const fixSignaturePrefix = (sig: string, signer: string): string => {
            const keyPrefix = signer.substring(0, 2); // '01' or '02'
            const sigPrefix = sig.substring(0, 2);

            // If signature already has a valid prefix (01 or 02), return as-is
            if (sigPrefix === '01' || sigPrefix === '02') {
                return sig;
            }

            // Otherwise, prepend the key's algorithm prefix
            return keyPrefix + sig;
        };

        // Add approval if not present
        const signerKey = deployWithApproval.header?.account;

        if (!signerKey) {
            return NextResponse.json({ error: "Deploy header missing account/signer" }, { status: 400 });
        }

        const hasApproval = deployWithApproval.approvals.some(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (a: any) => {
                if (!a.signer || !a.signature) return false;
                const fixedSig = fixSignaturePrefix(a.signature, a.signer);
                return fixedSig === fixSignaturePrefix(signatureHex, signerKey);
            }
        );

        if (!hasApproval && signatureHex && signerKey) {
            const fixedSignature = fixSignaturePrefix(signatureHex, signerKey);
            console.log(`[Proxy] Adding approval - signer: ${signerKey.substring(0, 10)}..., sig: ${fixedSignature.substring(0, 20)}...`);
            deployWithApproval.approvals.push({
                signer: signerKey,
                signature: fixedSignature
            });
        }

        // Also fix any existing approvals that might have wrong format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        deployWithApproval.approvals = deployWithApproval.approvals.map((a: any) => ({
            signer: a.signer,
            signature: fixSignaturePrefix(a.signature, a.signer)
        }));

        // Sanity check
        if (deployWithApproval.approvals.length === 0) {
            return NextResponse.json({ error: "Deploy has no approvals/signatures" }, { status: 400 });
        }

        // Submit to RPC directly via fetch to avoid SDK serialization issues
        // Method: account_put_deploy
        const rpcPayload = {
            id: Date.now(),
            jsonrpc: "2.0",
            method: "account_put_deploy",
            params: {
                deploy: deployWithApproval
            }
        };

        const rpcResponse = await fetch(appConfig.rpcUrls.primary, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rpcPayload)
        });

        if (!rpcResponse.ok) {
            throw new Error(`RPC returned ${rpcResponse.status}`);
        }

        const rpcResult = await rpcResponse.json();

        if (rpcResult.error) {
            console.error("[Proxy] RPC Error:", JSON.stringify(rpcResult.error));
            return NextResponse.json({ error: `RPC Error: ${rpcResult.error.message}` }, { status: 500 });
        }

        const deployHash = rpcResult.result?.deploy_hash;
        console.log(`[Proxy] Deploy submitted successfully: ${deployHash}`);

        return NextResponse.json({ deployHash }, { status: 200 });

    } catch (error) {
        console.error("[Proxy] Deploy submission failed:", error);
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: `Deploy submission failed: ${msg}` }, { status: 500 });
    }
}
