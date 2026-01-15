import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenBalance } from "@/lib/casper";

type RouteContext = {
    params: Promise<{ id: string }>;
};

// GET /api/projects/[id]/balance?wallet=<publicKey>
// Get user's token balance for this project
export async function GET(request: NextRequest, context: RouteContext) {
    const { id: projectId } = await context.params;
    const wallet = request.nextUrl.searchParams.get("wallet");

    if (!wallet) {
        return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }

    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: {
                tokenContractHash: true,
                tokenSymbol: true,
                tokenStatus: true,
            },
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        if (!project.tokenContractHash || project.tokenStatus !== "DEPLOYED") {
            return NextResponse.json({
                balance: "0",
                formatted: "0.00",
                tokenSymbol: project.tokenSymbol,
                message: "Token not yet deployed",
            });
        }

        // Get balance from blockchain
        const balanceRaw = await getTokenBalance(project.tokenContractHash, wallet);

        // Assuming 9 decimals for CEP-18 tokens
        const balanceNumber = Number(balanceRaw) / 1_000_000_000;

        return NextResponse.json({
            balance: balanceRaw,
            formatted: balanceNumber.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4
            }),
            tokenSymbol: project.tokenSymbol,
        });
    } catch (error) {
        console.error("Balance fetch error:", error);
        return NextResponse.json({
            balance: "0",
            formatted: "0.00",
            error: error instanceof Error ? error.message : "Failed to fetch balance",
        });
    }
}
