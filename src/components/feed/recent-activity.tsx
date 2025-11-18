import { prisma } from "@/lib/db";
import Link from "next/link";

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function abbreviateWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

export async function RecentActivity() {
  // Fetch recent orders
  const recentOrders = await prisma.projectOrder.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          tokenSymbol: true,
        },
      },
    },
  });

  // Fetch recently created projects
  const recentProjects = await prisma.project.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      tokenSymbol: true,
      creatorAddress: true,
      createdAt: true,
    },
  });

  // Combine and sort by time
  const activities = [
    ...recentOrders.map((order) => ({
      type: "order" as const,
      timestamp: order.createdAt,
      wallet: order.wallet,
      action: order.side === "BUY" ? "invested" : "sold tokens",
      projectId: order.project.id,
      projectTitle: order.project.title,
      tokenSymbol: order.project.tokenSymbol,
      amount: order.tokenAmount * order.pricePerToken,
      tokenAmount: order.tokenAmount,
    })),
    ...recentProjects.map((project) => ({
      type: "launch" as const,
      timestamp: project.createdAt,
      wallet: project.creatorAddress,
      action: "launched a project",
      projectId: project.id,
      projectTitle: project.title,
      tokenSymbol: project.tokenSymbol,
      amount: 0,
      tokenAmount: 0,
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 12);

  if (activities.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-brand-200 bg-white p-12 text-center">
        <p className="text-brand-600">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div
          key={`${activity.type}-${activity.projectId}-${index}`}
          className="group relative overflow-hidden rounded-xl border border-brand-200 bg-white p-4 transition-all hover:border-brand-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                activity.type === "launch"
                  ? "bg-purple-100 text-purple-600"
                  : activity.action === "invested"
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-red-600"
              }`}>
                {activity.type === "launch" ? "🚀" : activity.action === "invested" ? "📈" : "📉"}
              </div>

              {/* Activity details */}
              <div className="flex-1">
                <p className="text-sm text-brand-800">
                  <span className="font-mono text-xs text-brand-500">
                    {abbreviateWallet(activity.wallet)}
                  </span>
                  {" "}
                  <span className="text-brand-700">{activity.action}</span>
                  {" "}
                  <Link
                    href={`/projects/${activity.projectId}`}
                    className="font-semibold text-brand-800 hover:text-brand-600"
                  >
                    {activity.projectTitle}
                  </Link>
                  {" "}
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                    {activity.tokenSymbol}
                  </span>
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs text-brand-500">
                  {activity.type === "order" && activity.amount > 0 && (
                    <>
                      <span>{activity.tokenAmount.toLocaleString()} token</span>
                      <span>•</span>
                      <span className="font-semibold">{activity.amount.toFixed(2)} CSPR</span>
                      <span>•</span>
                    </>
                  )}
                  <span>{formatTimeAgo(activity.timestamp)}</span>
                </div>
              </div>
            </div>

            {/* Hover indicator */}
            <div className="flex-shrink-0 text-brand-400 opacity-0 transition-opacity group-hover:opacity-100">
              →
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
