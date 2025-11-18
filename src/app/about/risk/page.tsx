import { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Methodology",
  description: "Explains how tokenized ventures are modeled on Casper Ignite.",
};

const steps = [
  {
    title: "1. Project Definition",
    detail:
      "The founder enters the title, detailed description, and token parameters (symbol, total supply, ownership share).",
  },
  {
    title: "2. Token Issuance",
    detail:
      "The portal triggers the CEP-18 contract deployment over Casper RPC and associates it with the project.",
  },
  {
    title: "3. Market Data",
    detail:
      "Buy/sell orders are stored in the ProjectOrder table; the metrics service refreshes price, market cap, and liquidity.",
  },
  {
    title: "4. Investor Transparency",
    detail:
      "Each project page surfaces supply, ownership share, founder address, and the order book in a single view.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Casper Ignite · Methodology
        </p>
        <h1 className="mt-2 text-3xl font-semibold">How Do Tokenized Ventures Work?</h1>
        <p className="mt-2 text-muted-foreground">
          Ignite represents a traditional equity slice as a CEP-18 token. The steps below summarize
          the portal's end-to-end workflows.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {steps.map((step) => (
          <Card key={step.title} className="border-4 border-brand-100 bg-white/90 shadow-cartoon-pop">
            <CardHeader>
              <p className="text-sm font-semibold text-brand-700">{step.title}</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-brand-700">{step.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <Card className="border-4 border-brand-100 bg-white/90 shadow-cartoon-pop">
          <CardHeader>
            <p className="font-semibold text-brand-800">Ethical Notes</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-brand-700">
            <p>
              Tokens listed on Ignite are experimental instruments that represent securities. Every
              founder is responsible for legal compliance and investor suitability.
            </p>
            <p>
              The portal never coordinates buy/sell calls; metrics are informational only and do not
              constitute investment advice.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
