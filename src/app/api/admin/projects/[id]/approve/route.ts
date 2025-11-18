import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const approveSchema = z.object({
  adminWallet: z.string().min(10, "Admin wallet address required"),
});

/**
 * POST /api/admin/projects/[id]/approve
 * Approve a project and move it to APPROVED market level
 *
 * Requirements:
 * - Project must have $100k+ market cap for 15 days
 * - Admin wallet signature verification (TODO: implement in production)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validation = approveSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { adminWallet } = validation.data;
    const projectId = params.id;

    // Get project with market cap history
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        metrics: true,
        marketCapHistory: {
          orderBy: { recordedAt: "desc" },
          take: 15,
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.marketLevel === "APPROVED") {
      return NextResponse.json(
        { error: "Project already approved" },
        { status: 400 }
      );
    }

    // Check if project meets approval criteria
    const currentMarketCap = project.metrics?.marketCap || 0;
    const MIN_MARKET_CAP_USD = 100_000;
    const MIN_HISTORY_DAYS = 15;

    // Verify market cap is above $100k
    if (currentMarketCap < MIN_MARKET_CAP_USD) {
      return NextResponse.json(
        {
          error: "Project does not meet market cap requirement",
          details: `Current: $${currentMarketCap.toLocaleString()}, Required: $${MIN_MARKET_CAP_USD.toLocaleString()}`,
        },
        { status: 400 }
      );
    }

    // Verify market cap has been above $100k for at least 15 days
    if (project.marketCapHistory.length < MIN_HISTORY_DAYS) {
      return NextResponse.json(
        {
          error: "Insufficient market cap history",
          details: `Need ${MIN_HISTORY_DAYS} days of data, have ${project.marketCapHistory.length} days`,
        },
        { status: 400 }
      );
    }

    // Check all history entries are above $100k
    const allAboveThreshold = project.marketCapHistory.every(
      (entry) => entry.marketCap >= MIN_MARKET_CAP_USD
    );

    if (!allAboveThreshold) {
      return NextResponse.json(
        {
          error: "Market cap fell below $100k within last 15 days",
          details: "Project must maintain $100k+ for full 15-day period",
        },
        { status: 400 }
      );
    }

    // TODO: In production, verify admin wallet signature
    // For now, we'll accept any valid wallet address

    // Approve the project
    const approvedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        marketLevel: "APPROVED",
        approvedAt: new Date(),
        approvedBy: adminWallet,
      },
      include: {
        metrics: true,
      },
    });

    return NextResponse.json({
      success: true,
      project: {
        id: approvedProject.id,
        title: approvedProject.title,
        marketLevel: approvedProject.marketLevel,
        approvedAt: approvedProject.approvedAt,
        approvedBy: approvedProject.approvedBy,
        marketCap: approvedProject.metrics?.marketCap,
      },
    });
  } catch (error) {
    console.error("Error approving project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/projects/[id]/approve
 * Check if project is eligible for approval
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        metrics: true,
        marketCapHistory: {
          orderBy: { recordedAt: "desc" },
          take: 15,
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const MIN_MARKET_CAP_USD = 100_000;
    const MIN_HISTORY_DAYS = 15;

    const currentMarketCap = project.metrics?.marketCap || 0;
    const meetsMarketCap = currentMarketCap >= MIN_MARKET_CAP_USD;
    const hasEnoughHistory = project.marketCapHistory.length >= MIN_HISTORY_DAYS;
    const allAboveThreshold = project.marketCapHistory.every(
      (entry) => entry.marketCap >= MIN_MARKET_CAP_USD
    );

    const eligible = meetsMarketCap && hasEnoughHistory && allAboveThreshold;

    return NextResponse.json({
      eligible,
      marketLevel: project.marketLevel,
      currentMarketCap,
      requirements: {
        marketCap: {
          met: meetsMarketCap,
          required: MIN_MARKET_CAP_USD,
          current: currentMarketCap,
        },
        historyDays: {
          met: hasEnoughHistory,
          required: MIN_HISTORY_DAYS,
          current: project.marketCapHistory.length,
        },
        consistentAboveThreshold: {
          met: allAboveThreshold,
        },
      },
    });
  } catch (error) {
    console.error("Error checking approval eligibility:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
