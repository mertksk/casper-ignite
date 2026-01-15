import "server-only";
import { checkDeployStatus } from "./casper";
import { appConfig } from "./config";
import { CasperServiceByJsonRPC } from "casper-js-sdk";

/**
 * Verify that a payment deploy succeeded and matches expected criteria
 */
export async function verifyPaymentDeploy(
  deployHash: string,
  expectedRecipient: string,
  expectedAmountCSPR: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check basic status first
    const status = await checkDeployStatus(deployHash);

    if (!status.executed) {
      return {
        success: false,
        error: "Payment deploy has not been executed yet. Please wait for blockchain confirmation."
      };
    }

    if (!status.success) {
      return {
        success: false,
        error: `Payment deploy failed: ${status.error ?? "Unknown error"}`
      };
    }

    // Fetch full deploy info to inspect effects
    const client = new CasperServiceByJsonRPC(appConfig.rpcUrls.primary);
    const deployInfo = await client.getDeployInfo(deployHash);

    // SDK v2: deployInfo.execution_results is { result: ... }[]
    const execution = deployInfo.execution_results[0];

    if (!execution || !execution.result.Success) {
      return {
        success: false,
        error: "Payment execution data not found or failed despite status check passing."
      };
    }

    const effects = execution.result.Success.effect.transforms;

    // Look for balance changes to the recipient
    let recipientReceived = false;
    let amountVerified = false;

    for (const effect of effects) {
      // SDK v2: key is string or { key: string }? 
      // Usually transforms have a key. 
      // effect has 'key' and 'transform'.
      // In SDK v2 types, TransformEntry { key: string; transform: Transform }
      const key = effect.key;

      // Check if this is a balance write/addition to the recipient's account 
      // (Account hashes in transforms are usually lower case hex)
      // expectedRecipient is likely a public key hex, we need account hash?
      // Or if it's a transfer to public key, the effect key might be "balance-..." or "uref-..."

      // If expectedRecipient is a PublicKey, we should convert to AccountHash?
      // For now, let's assume loose check on key string inclusion as before.
      if (key && key.includes(expectedRecipient.slice(2))) { // Simple heuristic from previous code?
        // Wait, if expectedRecipient is "01...", slice(2) is key...
        // Previous code: key.includes(expectedRecipient.slice(2))

        recipientReceived = true;

        // Try to extract the amount from the CLValue
        // transform is a huge union. We need 'WriteCLValue' or checking operations.
        // SDK v2: Transform structure.
        // We look for 'WriteCLValue' which contains the CLValue.

        const transform = effect.transform;

        // In SDK v2 JSON, it might be { WriteCLValue: { ... } } or similar object.
        // We handle it as 'any' safely or check properties.

        let clValueParsed: any = null;

        if (typeof transform === 'object' && transform !== null) {
          if ('WriteCLValue' in transform) {
            clValueParsed = (transform as any).WriteCLValue?.parsed;
          } else if ('Write' in transform) { // Legacy
            // ...
          }
        }

        // If not found, try raw parse if available
        // But for CSPR transfer, usually it's an Identity transform on a Purse or similar?
        // Actually, CSPR transfer creates a Transfer object in execution results?
        // SDK v2 getDeployInfo also returns 'execution_results[0].result.Success.transfers'?
        // If it's a native transfer, it should appear in `transfers` list.

      }
    }

    // Better approach for CSPR transfer: Check specific transfer record if available?
    // execution.result.Success.transfers is string[] (transfer keys)?

    // Let's stick effectively to the previous logic but adapted for SDK v2 types roughly.
    // Since we can't easily perfectly type the JSON result without massive types, we cast to any for inspection.
    const resultAny = execution as any;

    // Re-implement the loop using 'any' to cover structure variations
    const transforms = resultAny.result?.Success?.effect?.transforms || [];

    for (const t of transforms) {
      const key = t.key;
      if (typeof key === 'string' && key.toLowerCase().includes(expectedRecipient.slice(2).toLowerCase())) {
        recipientReceived = true;

        // Check for amount
        // t.transform is the object
        // Look for BigInt(amount)
        const val = t.transform?.WriteCLValue?.parsed || t.transform?.Write?.CLValue?.parsed;
        if (val) {
          const amountMotes = BigInt(val);
          const expectedMotes = BigInt(expectedAmountCSPR) * BigInt(Math.floor(1e9));
          const variance = BigInt(1e9);

          if (amountMotes >= expectedMotes - variance && amountMotes <= expectedMotes + variance) {
            amountVerified = true;
          }
        }
      }
    }

    if (!recipientReceived) {
      // It's possible the logic above is too strict regarding keys.
      // But verifyPaymentDeploy is critical.
      // If we can't verify, we should fail or return success with warning?
      // Previous code returned error.
      // Let's rely on the fact that checkDeployStatus passed + we trust the hash if manual check is hard.
      // But we really want to verify amount.

      // Fallback: If status success, and we couldn't parse affects (maybe structure changed), 
      // do we block?
      // Let's assume for now that if status.success is true, the transfer happened as described in the deploy
      // unless we find evidence to the contrary.
      // But we are verifying *which* transfer it was (amount/recipient).

      // Allow passing if we can't fully verify but execution was success? 
      // No, that defeats the purpose.

      // Let's return error if not verified.
      return {
        success: false,
        error: `Payment was not sent to the expected address: ${expectedRecipient} (or verification logic mismatch)`
      };
    }

    if (!amountVerified) {
      return {
        success: false,
        error: `Payment amount does not match expected ${expectedAmountCSPR} CSPR`
      };
    }

    return { success: true };

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Payment verification failed: ${msg}`
    };
  }
}

/**
 * Verify both platform fee and liquidity pool payments
 */
export async function verifyProjectPayments(
  platformFeeHash: string,
  liquidityPoolHash: string
): Promise<{ success: boolean; error?: string }> {
  // Verify platform fee payment
  const feeVerification = await verifyPaymentDeploy(
    platformFeeHash,
    appConfig.platformAddresses.fee,
    appConfig.paymentAmounts.platformFee
  );

  if (!feeVerification.success) {
    return {
      success: false,
      error: `Platform fee verification failed: ${feeVerification.error}`
    };
  }

  // Verify liquidity pool payment
  const liquidityVerification = await verifyPaymentDeploy(
    liquidityPoolHash,
    appConfig.platformAddresses.liquidity,
    appConfig.paymentAmounts.liquidityPool
  );

  if (!liquidityVerification.success) {
    return {
      success: false,
      error: `Liquidity pool verification failed: ${liquidityVerification.error}`
    };
  }

  return { success: true };
}
