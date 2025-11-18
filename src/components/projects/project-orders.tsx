import { Card, CardContent, CardHeader } from "../ui/card";

type Order = {
  id: string;
  wallet: string;
  side: "BUY" | "SELL";
  tokenAmount: number;
  pricePerToken: number;
  createdAt: string;
};

export function ProjectOrders({ orders }: { orders: Order[] }) {
  if (!orders.length) {
    return (
      <Card className="border-4 border-dashed border-brand-200/70 bg-white/70">
        <CardContent className="py-6 text-center text-brand-600">
          No buy/sell orders yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-4 border-brand-100 bg-white/90 shadow-cartoon-pop">
      <CardHeader>
        <p className="text-base font-semibold text-brand-700">Market Orders</p>
        <p className="text-sm text-brand-600">
          Displays the latest 25 buy/sell executions.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {orders.map((order) => (
          <div
            key={order.id}
            className="flex flex-col gap-1 rounded-2xl border border-brand-100 bg-brand-50/80 p-3 text-sm text-brand-700 shadow-sm md:flex-row md:items-center md:justify-between"
          >
            <div className="flex items-center gap-2 font-semibold">
              <span
                className={
                  order.side === "BUY" ? "text-risk-neutral" : "text-risk-danger"
                }
              >
                {order.side === "BUY" ? "Buy" : "Sell"}
              </span>
              <span className="text-xs text-brand-500">
                {new Date(order.createdAt).toLocaleString("en-US", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            </div>
            <div className="text-brand-800">
              {order.tokenAmount.toLocaleString()} token · $
              {order.pricePerToken.toFixed(2)} / token
            </div>
            <div className="font-mono text-xs text-brand-500">{order.wallet}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
