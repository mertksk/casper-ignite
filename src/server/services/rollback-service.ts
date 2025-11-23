import "server-only";
import { prisma } from "@/lib/db";
import { notificationService } from "./notification-service";

/**
 * Rollback Service
 * Handles reverting failed transactions to maintain database consistency
 */

interface BuyRollbackParams {
  projectId: string;
  tokenAmount: number;
  cost: number;
  deployHash: string;
  reason: string;
}

interface SellRollbackParams {
  projectId: string;
  tokenAmount: number;
  proceeds: number;
  deployHash: string;
  reason: string;
}

class RollbackService {
  /**
   * Rollback a failed buy transaction
   * Reverses bonding curve state and project metrics
   */
  async rollbackBuy(params: BuyRollbackParams): Promise<void> {
    const { projectId, tokenAmount, cost, deployHash, reason } = params;

    console.error(`[ROLLBACK BUY] Starting rollback for project ${projectId}`, {
      tokenAmount,
      cost,
      deployHash,
      reason,
    });

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Reverse bonding curve state
        const curve = await tx.bondingCurve.findUnique({
          where: { projectId },
        });

        if (!curve) {
          throw new Error("Bonding curve not found");
        }

        const newSupply = curve.currentSupply - tokenAmount;
        const newReserveBalance = curve.reserveBalance - cost;

        await tx.bondingCurve.update({
          where: { projectId },
          data: {
            currentSupply: Math.max(0, newSupply),
            reserveBalance: Math.max(0, newReserveBalance),
          },
        });

        // 2. Calculate new price after rollback
        const slope = this.calculateSlope(curve.initialPrice, curve.reserveRatio);
        const rolledBackPrice = curve.initialPrice + slope * newSupply;

        // 3. Reverse project metrics
        await tx.projectMetric.update({
          where: { projectId },
          data: {
            currentPrice: rolledBackPrice,
            marketCap: {
              decrement: cost,
            },
            totalInvestors: {
              decrement: 1,
            },
          },
        });

        // 4. Delete the last price history entry (the failed trade)
        const lastEntry = await tx.priceHistory.findFirst({
          where: { projectId },
          orderBy: { timestamp: "desc" },
        });

        if (lastEntry) {
          await tx.priceHistory.delete({
            where: { id: lastEntry.id },
          });
        }

        // 5. Create rollback audit record
        await tx.$executeRaw`
          INSERT INTO "RollbackLog" (id, "projectId", "tradeType", "tokenAmount", amount, "deployHash", reason, "createdAt")
          VALUES (gen_random_uuid(), ${projectId}, 'BUY', ${tokenAmount}, ${cost}, ${deployHash}, ${reason}, NOW())
          ON CONFLICT DO NOTHING
        `;
      });

      console.log(`[ROLLBACK BUY] Successfully rolled back buy transaction for project ${projectId}`);
    } catch (error) {
      console.error(`[ROLLBACK BUY] CRITICAL - Rollback failed for project ${projectId}:`, error);

      // Alert admin - this requires manual intervention
      await this.sendCriticalAlert({
        type: "ROLLBACK_FAILED",
        projectId,
        deployHash,
        error: error instanceof Error ? error.message : String(error),
        params,
      });

      throw new Error("Rollback failed - manual intervention required");
    }
  }

  /**
   * Rollback a failed sell transaction
   * Reverses bonding curve state and project metrics
   */
  async rollbackSell(params: SellRollbackParams): Promise<void> {
    const { projectId, tokenAmount, proceeds, deployHash, reason } = params;

    console.error(`[ROLLBACK SELL] Starting rollback for project ${projectId}`, {
      tokenAmount,
      proceeds,
      deployHash,
      reason,
    });

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Reverse bonding curve state
        const curve = await tx.bondingCurve.findUnique({
          where: { projectId },
        });

        if (!curve) {
          throw new Error("Bonding curve not found");
        }

        const newSupply = curve.currentSupply + tokenAmount;
        const newReserveBalance = curve.reserveBalance + proceeds;

        await tx.bondingCurve.update({
          where: { projectId },
          data: {
            currentSupply: newSupply,
            reserveBalance: newReserveBalance,
          },
        });

        // 2. Calculate new price after rollback
        const slope = this.calculateSlope(curve.initialPrice, curve.reserveRatio);
        const rolledBackPrice = curve.initialPrice + slope * newSupply;

        // 3. Reverse project metrics
        await tx.projectMetric.update({
          where: { projectId },
          data: {
            currentPrice: rolledBackPrice,
            marketCap: {
              increment: proceeds,
            },
          },
        });

        // 4. Delete the last price history entry (the failed trade)
        const lastEntry = await tx.priceHistory.findFirst({
          where: { projectId },
          orderBy: { timestamp: "desc" },
        });

        if (lastEntry) {
          await tx.priceHistory.delete({
            where: { id: lastEntry.id },
          });
        }

        // 5. Create rollback audit record
        await tx.$executeRaw`
          INSERT INTO "RollbackLog" (id, "projectId", "tradeType", "tokenAmount", amount, "deployHash", reason, "createdAt")
          VALUES (gen_random_uuid(), ${projectId}, 'SELL', ${tokenAmount}, ${proceeds}, ${deployHash}, ${reason}, NOW())
          ON CONFLICT DO NOTHING
        `;
      });

      console.log(`[ROLLBACK SELL] Successfully rolled back sell transaction for project ${projectId}`);
    } catch (error) {
      console.error(`[ROLLBACK SELL] CRITICAL - Rollback failed for project ${projectId}:`, error);

      // Alert admin - this requires manual intervention
      await this.sendCriticalAlert({
        type: "ROLLBACK_FAILED",
        projectId,
        deployHash,
        error: error instanceof Error ? error.message : String(error),
        params,
      });

      throw new Error("Rollback failed - manual intervention required");
    }
  }

  /**
   * Calculate slope for linear bonding curve
   * (duplicated from bonding-curve-service for independence)
   */
  private calculateSlope(initialPrice: number, reserveRatio: number): number {
    return initialPrice * reserveRatio * 0.0001;
  }

  /**
   * Send critical alert to admin
   * Sends to all configured channels (Slack, email, etc.) and logs to database
   */
  private async sendCriticalAlert(alert: {
    type: string;
    projectId: string;
    deployHash: string;
    error: string;
    params: unknown;
  }): Promise<void> {
    // Send to notification channels
    await notificationService.sendCriticalAlert(
      `${alert.type} - Project ${alert.projectId.slice(0, 8)}`,
      `Rollback operation failed for deploy ${alert.deployHash}. Error: ${alert.error}`,
      {
        projectId: alert.projectId,
        deployHash: alert.deployHash,
        type: alert.type,
        params: alert.params,
      }
    );

    // Store in database for admin dashboard
    try {
      await prisma.$executeRaw`
        INSERT INTO "CriticalAlert" (id, type, "projectId", "deployHash", error, metadata, "createdAt")
        VALUES (gen_random_uuid(), ${alert.type}, ${alert.projectId}, ${alert.deployHash}, ${alert.error}, ${JSON.stringify(alert.params)}, NOW())
        ON CONFLICT DO NOTHING
      `;
    } catch (err) {
      console.error("Failed to log critical alert to database:", err);
    }
  }
}

export const rollbackService = new RollbackService();
