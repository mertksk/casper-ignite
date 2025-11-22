import "server-only";
import { checkDeployStatus } from "./casper";
import { appConfig } from "./config";

/**
 * Verify that a payment deploy succeeded and matches expected criteria
 */
export async function verifyPaymentDeploy(
  deployHash: string,
  expectedRecipient: string,
  expectedAmountCSPR: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check deploy status
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

    // Parse the deploy to verify transfer details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = status.result as any;

    // For CSPR transfers, check the execution effects for the transfer
    const effects = result?.result?.success?.effect?.transforms ??
                   result?.result?.Success?.effect?.transforms ??
                   result?.result?.success?.effects ??
                   result?.result?.Success?.effects ??
                   [];

    // Look for balance changes to the recipient
    let recipientReceived = false;
    let amountVerified = false;

    for (const effect of effects) {
      const key = typeof effect.key === 'string' ? effect.key : effect.key?.toString?.();

      // Check if this is a balance write to the recipient's account
      if (key && key.includes(expectedRecipient.slice(2))) {
        recipientReceived = true;

        // Try to extract the amount from the CLValue
        const transform = effect.transform ?? effect.kind ?? effect;
        const clValue = transform?.transformationData?.CLValue ??
                       transform?.Write?.CLValue ??
                       transform?.clValue;

        if (clValue?.parsed) {
          const amountMotes = BigInt(clValue.parsed.toString());

          // Allow small variance for gas costs (±1 CSPR)
          const expectedMotes = BigInt(expectedAmountCSPR) * BigInt(1_000_000_000);
          const variance = BigInt(1_000_000_000); // 1 CSPR variance

          if (amountMotes >= expectedMotes - variance && amountMotes <= expectedMotes + variance) {
            amountVerified = true;
          }
        }
      }
    }

    if (!recipientReceived) {
      return {
        success: false,
        error: `Payment was not sent to the expected address: ${expectedRecipient}`
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
