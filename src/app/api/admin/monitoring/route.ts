import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Admin monitoring dashboard endpoint
 * Returns critical metrics and alerts for admin review
 */
export async function GET() {
  try {
    // 1. Get unresolved critical alerts
    const criticalAlerts = await prisma.criticalAlert.findMany({
      where: { resolved: false },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // 2. Get recent rollbacks (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentRollbacks = await prisma.rollbackLog.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // 3. Get rollback statistics
    const rollbackStats = await prisma.$queryRaw<Array<{ tradeType: string; count: bigint }>>`
      SELECT "tradeType", COUNT(*) as count
      FROM "RollbackLog"
      WHERE "createdAt" >= ${sevenDaysAgo}
      GROUP BY "tradeType"
    `;

    // 4. Get trading volume metrics (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTrades = await prisma.priceHistory.count({
      where: {
        timestamp: { gte: yesterday },
      },
    });

    // 5. Get failed projects (token deployment failed)
    const failedProjects = await prisma.project.count({
      where: {
        tokenStatus: "FAILED",
      },
    });

    // 6. Get pending projects (awaiting deployment)
    const pendingProjects = await prisma.project.count({
      where: {
        tokenStatus: "PENDING",
      },
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      alerts: {
        critical: criticalAlerts.length,
        list: criticalAlerts.map((alert) => ({
          id: alert.id,
          type: alert.type,
          projectId: alert.projectId,
          deployHash: alert.deployHash,
          error: alert.error,
          createdAt: alert.createdAt.toISOString(),
        })),
      },
      rollbacks: {
        total7Days: recentRollbacks.length,
        byType: rollbackStats.map((stat) => ({
          type: stat.tradeType,
          count: Number(stat.count),
        })),
        recent: recentRollbacks.slice(0, 10).map((rb) => ({
          id: rb.id,
          projectId: rb.projectId,
          tradeType: rb.tradeType,
          tokenAmount: rb.tokenAmount,
          amount: rb.amount,
          reason: rb.reason,
          createdAt: rb.createdAt.toISOString(),
        })),
      },
      trading: {
        trades24h: recentTrades,
      },
      projects: {
        failed: failedProjects,
        pending: pendingProjects,
      },
    });
  } catch (error) {
    console.error("Monitoring dashboard error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch monitoring data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
