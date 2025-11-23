import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Simple admin authentication check
function checkAdminAuth() {
  // TODO: Replace with proper authentication
  // For now, just check if we're in dev mode
  if (process.env.NODE_ENV !== "development") {
    return false;
  }
  return true;
}

async function getMonitoringData() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/admin/monitoring`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch monitoring data");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching monitoring data:", error);
    return null;
  }
}

export default async function AdminMonitoringPage() {
  if (!checkAdminAuth()) {
    notFound();
  }

  const data = await getMonitoringData();

  if (!data) {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold text-red-600">Failed to load monitoring data</h1>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-brand-900">Admin Monitoring Dashboard</h1>
        <p className="text-sm text-brand-600">Last updated: {new Date(data.timestamp).toLocaleString()}</p>
      </div>

      {/* Critical Alerts */}
      <Card className="border-4 border-red-300 bg-white shadow-cartoon-pop">
        <CardHeader>
          <h2 className="text-2xl font-bold text-red-700">
            🚨 Critical Alerts ({data.alerts.critical})
          </h2>
        </CardHeader>
        <CardContent>
          {data.alerts.critical === 0 ? (
            <p className="text-green-600 font-semibold">✅ No critical alerts</p>
          ) : (
            <div className="space-y-3">
              {data.alerts.list.map((alert: {
                id: string;
                type: string;
                projectId: string;
                deployHash: string;
                error: string;
                createdAt: string;
              }) => (
                <div key={alert.id} className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-bold text-red-800">{alert.type}</p>
                      <p className="text-sm text-red-700">Project: {alert.projectId.slice(0, 12)}...</p>
                      <p className="text-sm text-red-700">Deploy: {alert.deployHash}</p>
                      <p className="text-sm text-red-600 mt-2">{alert.error}</p>
                    </div>
                    <div className="text-xs text-red-500">
                      {new Date(alert.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rollback Statistics */}
      <Card className="border-4 border-orange-300 bg-white shadow-cartoon-pop">
        <CardHeader>
          <h2 className="text-2xl font-bold text-orange-700">
            ⏪ Rollbacks (Last 7 Days)
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-orange-50 p-4 text-center">
              <p className="text-3xl font-bold text-orange-800">{data.rollbacks.total7Days}</p>
              <p className="text-sm text-orange-600">Total Rollbacks</p>
            </div>
            <div className="space-y-2">
              {data.rollbacks.byType.map((stat: { type: string; count: number }) => (
                <div key={stat.type} className="flex items-center justify-between rounded-lg bg-orange-50 p-3">
                  <span className="font-semibold text-orange-700">{stat.type}</span>
                  <span className="text-2xl font-bold text-orange-800">{stat.count}</span>
                </div>
              ))}
            </div>
          </div>

          {data.rollbacks.recent.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 font-semibold text-orange-800">Recent Rollbacks</h3>
              <div className="space-y-2">
                {data.rollbacks.recent.map((rb: {
                  id: string;
                  projectId: string;
                  tradeType: string;
                  tokenAmount: number;
                  amount: number;
                  reason: string;
                  createdAt: string;
                }) => (
                  <div key={rb.id} className="rounded-lg border border-orange-200 bg-white p-3 text-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-orange-700">{rb.tradeType}</span>
                        <span className="ml-2 text-orange-600">
                          {rb.tokenAmount} tokens / {rb.amount.toFixed(2)} CSPR
                        </span>
                        <p className="mt-1 text-xs text-orange-500">{rb.reason}</p>
                      </div>
                      <span className="text-xs text-orange-400">
                        {new Date(rb.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trading Activity */}
      <Card className="border-4 border-blue-300 bg-white shadow-cartoon-pop">
        <CardHeader>
          <h2 className="text-2xl font-bold text-blue-700">
            📈 Trading Activity (Last 24 Hours)
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <p className="text-3xl font-bold text-blue-800">{data.trading.trades24h}</p>
              <p className="text-sm text-blue-600">Total Trades</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Status */}
      <Card className="border-4 border-brand-300 bg-white shadow-cartoon-pop">
        <CardHeader>
          <h2 className="text-2xl font-bold text-brand-700">
            🎯 Project Status
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-yellow-50 p-4 text-center border-2 border-yellow-200">
              <p className="text-3xl font-bold text-yellow-800">{data.projects.pending}</p>
              <p className="text-sm text-yellow-600">Pending Deployment</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center border-2 border-red-200">
              <p className="text-3xl font-bold text-red-800">{data.projects.failed}</p>
              <p className="text-sm text-red-600">Failed Deployments</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="border-4 border-gray-300 bg-white shadow-cartoon-pop">
        <CardHeader>
          <h2 className="text-2xl font-bold text-gray-700">
            ℹ️ System Information
          </h2>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Environment:</span>
            <span className="font-mono font-semibold">{process.env.NODE_ENV}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Network:</span>
            <span className="font-mono font-semibold">{process.env.NEXT_PUBLIC_CHAIN_NAME}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">RPC URL:</span>
            <span className="font-mono text-xs">{process.env.NEXT_PUBLIC_RPC_URL}</span>
          </div>
        </CardContent>
      </Card>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <form action="/admin/monitoring">
          <button
            type="submit"
            className="rounded-full bg-brand-500 px-8 py-3 font-semibold text-white shadow-cartoon-pop hover:bg-brand-600 transition-all"
          >
            🔄 Refresh Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}
