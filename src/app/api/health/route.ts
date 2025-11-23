import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Health check endpoint
 * Returns system status and critical metrics
 */
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: string; latency?: number; error?: string; details?: unknown }> = {};

  // 1. Database check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: "healthy",
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // 3. Critical alerts check
  try {
    const unresolvedAlerts = await prisma.criticalAlert.count({
      where: { resolved: false },
    });

    checks.criticalAlerts = {
      status: unresolvedAlerts === 0 ? "healthy" : "warning",
      details: { unresolvedCount: unresolvedAlerts },
    };
  } catch (error) {
    checks.criticalAlerts = {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // 4. Recent rollbacks check (last 24 hours)
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRollbacks = await prisma.rollbackLog.count({
      where: {
        createdAt: { gte: yesterday },
      },
    });

    checks.recentRollbacks = {
      status: recentRollbacks === 0 ? "healthy" : "warning",
      details: { count24h: recentRollbacks },
    };
  } catch (error) {
    checks.recentRollbacks = {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Determine overall status
  const hasUnhealthy = Object.values(checks).some((check) => check.status === "unhealthy");
  const hasWarning = Object.values(checks).some((check) => check.status === "warning");

  const overallStatus = hasUnhealthy ? "unhealthy" : hasWarning ? "warning" : "healthy";
  const totalLatency = Date.now() - startTime;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      latency: totalLatency,
      checks,
      environment: process.env.NODE_ENV || "unknown",
    },
    {
      status: overallStatus === "unhealthy" ? 503 : 200,
    }
  );
}
