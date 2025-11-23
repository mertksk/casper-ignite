import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How It Works · Casper Radar",
  description: "Learn how Casper Radar's bonding curve-powered token launchpad works",
};

export default function HowItWorksPage() {
  return (
    <div className="container mx-auto space-y-12 px-4 py-12">
      {/* Hero Section */}
      <section className="text-center">
        <h1 className="mb-4 text-5xl font-bold text-brand-900">
          How Casper Radar Works
        </h1>
        <p className="mx-auto max-w-3xl text-xl text-brand-700">
          A fair, transparent, and decentralized token launchpad powered by bonding curves
          on the Casper blockchain.
        </p>
      </section>

      {/* Overview */}
      <section>
        <Card className="border-4 border-brand-100 bg-gradient-to-br from-brand-50 to-white shadow-cartoon-pop">
          <CardHeader>
            <h2 className="text-3xl font-bold text-brand-900">Platform Overview</h2>
          </CardHeader>
          <CardContent className="space-y-4 text-brand-700">
            <p className="text-lg">
              Casper Radar is a <strong>bonding curve-powered token launchpad</strong> that makes
              it easy for anyone to launch and trade tokens on Casper. No complicated DEX listings,
              no liquidity pools to manage—just instant, fair, algorithmic pricing.
            </p>
            <p className="text-lg">
              Projects pay a small fee (200 CSPR), and we handle everything: token deployment,
              liquidity, and trading infrastructure. Traders can buy and sell instantly with
              transparent, predictable pricing.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* How It Works - Step by Step */}
      <section>
        <h2 className="mb-8 text-center text-3xl font-bold text-brand-900">
          The Journey: From Idea to Trading
        </h2>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Step 1: Project Creation */}
          <Card className="border-4 border-green-300 bg-white shadow-cartoon-pop">
            <CardHeader>
              <div className="mb-2 inline-block rounded-full bg-green-100 px-4 py-1 text-sm font-bold text-green-700">
                STEP 1
              </div>
              <h3 className="text-2xl font-bold text-green-800">
                🚀 Launch Your Project
              </h3>
            </CardHeader>
            <CardContent className="space-y-3 text-brand-700">
              <p className="font-semibold">Creators submit their project with:</p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>Project name, description, and roadmap</li>
                <li>Token symbol and total supply</li>
                <li>Ownership percentage (how many tokens you keep)</li>
                <li>Category and funding goal</li>
              </ul>
              <div className="mt-4 rounded-lg bg-green-50 border-2 border-green-200 p-3">
                <p className="text-sm font-semibold text-green-800">💰 Listing Fee: 200 CSPR</p>
                <p className="text-xs text-green-700">
                  20 CSPR platform fee + 180 CSPR initial liquidity
                </p>
              </div>
              <p className="text-sm mt-4">
                <strong>What happens behind the scenes:</strong>
              </p>
              <ul className="space-y-1 pl-5 text-sm list-disc">
                <li>Platform deploys your CEP-18 token (you don&apos;t pay gas!)</li>
                <li>Tokens are minted to platform wallet</li>
                <li>Your ownership % is automatically transferred to your wallet</li>
                <li>Remaining tokens go into the bonding curve for trading</li>
              </ul>
            </CardContent>
          </Card>

          {/* Step 2: Bonding Curve */}
          <Card className="border-4 border-blue-300 bg-white shadow-cartoon-pop">
            <CardHeader>
              <div className="mb-2 inline-block rounded-full bg-blue-100 px-4 py-1 text-sm font-bold text-blue-700">
                STEP 2
              </div>
              <h3 className="text-2xl font-bold text-blue-800">
                📈 Bonding Curve Activation
              </h3>
            </CardHeader>
            <CardContent className="space-y-3 text-brand-700">
              <p className="font-semibold">Your token is now tradeable with:</p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>Initial price: 0.001 CSPR per token</li>
                <li>180 CSPR reserve (from your listing fee)</li>
                <li>Linear bonding curve (fair, predictable pricing)</li>
              </ul>
              <div className="mt-4 rounded-lg bg-blue-50 border-2 border-blue-200 p-3">
                <p className="text-sm font-semibold text-blue-800">🔢 Price Formula</p>
                <p className="text-xs font-mono text-blue-700 mt-1">
                  price = initialPrice + (slope × supply)
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Price increases as more tokens are bought
                </p>
              </div>
              <p className="text-sm mt-4">
                <strong>Why bonding curves?</strong>
              </p>
              <ul className="space-y-1 pl-5 text-sm list-disc">
                <li>No need for traditional liquidity pools</li>
                <li>Instant buy/sell at any time</li>
                <li>Fair pricing based on supply and demand</li>
                <li>No front-running or manipulation</li>
              </ul>
            </CardContent>
          </Card>

          {/* Step 3: Trading */}
          <Card className="border-4 border-purple-300 bg-white shadow-cartoon-pop">
            <CardHeader>
              <div className="mb-2 inline-block rounded-full bg-purple-100 px-4 py-1 text-sm font-bold text-purple-700">
                STEP 3
              </div>
              <h3 className="text-2xl font-bold text-purple-800">
                💱 Instant Trading
              </h3>
            </CardHeader>
            <CardContent className="space-y-3 text-brand-700">
              <p className="font-semibold">Traders can now:</p>

              <div className="space-y-3">
                <div className="rounded-lg bg-green-50 border-2 border-green-200 p-3">
                  <p className="font-semibold text-green-800">🟢 BUY Tokens</p>
                  <ol className="mt-2 space-y-1 pl-5 text-sm list-decimal">
                    <li>Connect Casper wallet</li>
                    <li>Enter token amount</li>
                    <li>See instant quote with price impact</li>
                    <li>Platform sends tokens directly to your wallet</li>
                  </ol>
                </div>

                <div className="rounded-lg bg-red-50 border-2 border-red-200 p-3">
                  <p className="font-semibold text-red-800">🔴 SELL Tokens</p>
                  <ol className="mt-2 space-y-1 pl-5 text-sm list-decimal">
                    <li>Platform checks you have enough tokens</li>
                    <li>Enter token amount to sell</li>
                    <li>See instant quote with price impact</li>
                    <li>Platform sends CSPR directly to your wallet</li>
                  </ol>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-purple-50 border-2 border-purple-200 p-3">
                <p className="text-sm font-semibold text-purple-800">⚡ Lightning Fast</p>
                <p className="text-xs text-purple-700">
                  Trades execute in 30-60 seconds with blockchain confirmation
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Step 4: Market Growth */}
          <Card className="border-4 border-orange-300 bg-white shadow-cartoon-pop">
            <CardHeader>
              <div className="mb-2 inline-block rounded-full bg-orange-100 px-4 py-1 text-sm font-bold text-orange-700">
                STEP 4
              </div>
              <h3 className="text-2xl font-bold text-orange-800">
                🎯 Market Levels
              </h3>
            </CardHeader>
            <CardContent className="space-y-3 text-brand-700">
              <p className="font-semibold">Projects progress through two levels:</p>

              <div className="space-y-3">
                <div className="rounded-lg bg-yellow-50 border-2 border-yellow-200 p-3">
                  <p className="font-semibold text-yellow-800">Level 1: PRE-MARKET</p>
                  <ul className="mt-2 space-y-1 pl-5 text-sm list-disc">
                    <li>All new projects start here</li>
                    <li>Fully tradeable on bonding curve</li>
                    <li>Build community and momentum</li>
                    <li>Prove project viability</li>
                  </ul>
                </div>

                <div className="rounded-lg bg-green-50 border-2 border-green-200 p-3">
                  <p className="font-semibold text-green-800">Level 2: APPROVED</p>
                  <ul className="mt-2 space-y-1 pl-5 text-sm list-disc">
                    <li>Promoted by platform admins</li>
                    <li>Higher visibility and trust</li>
                    <li>Featured placement</li>
                    <li>Continued bonding curve trading</li>
                  </ul>
                </div>
              </div>

              <p className="text-sm mt-4">
                <strong>Promotion criteria:</strong> Strong community, active development,
                transparent roadmap, and healthy trading volume.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Key Features */}
      <section>
        <h2 className="mb-8 text-center text-3xl font-bold text-brand-900">
          Why Choose Casper Radar?
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-4 border-brand-100 bg-white shadow-cartoon-sm">
            <CardContent className="p-6 text-center">
              <div className="mb-4 text-5xl">🔒</div>
              <h3 className="mb-2 text-xl font-bold text-brand-900">Secure</h3>
              <p className="text-sm text-brand-700">
                Built on Casper blockchain with enterprise-grade security. All transactions
                are verified on-chain with automatic rollback on failures.
              </p>
            </CardContent>
          </Card>

          <Card className="border-4 border-brand-100 bg-white shadow-cartoon-sm">
            <CardContent className="p-6 text-center">
              <div className="mb-4 text-5xl">⚡</div>
              <h3 className="mb-2 text-xl font-bold text-brand-900">Instant</h3>
              <p className="text-sm text-brand-700">
                No waiting for order matching. Buy or sell any amount instantly
                with transparent, algorithmic pricing.
              </p>
            </CardContent>
          </Card>

          <Card className="border-4 border-brand-100 bg-white shadow-cartoon-sm">
            <CardContent className="p-6 text-center">
              <div className="mb-4 text-5xl">📊</div>
              <h3 className="mb-2 text-xl font-bold text-brand-900">Transparent</h3>
              <p className="text-sm text-brand-700">
                Every trade follows the bonding curve formula. No hidden fees,
                no manipulation, just math.
              </p>
            </CardContent>
          </Card>

          <Card className="border-4 border-brand-100 bg-white shadow-cartoon-sm">
            <CardContent className="p-6 text-center">
              <div className="mb-4 text-5xl">💰</div>
              <h3 className="mb-2 text-xl font-bold text-brand-900">Fair Launch</h3>
              <p className="text-sm text-brand-700">
                Everyone gets the same price at the same time. No private sales,
                no whitelists, no special treatment.
              </p>
            </CardContent>
          </Card>

          <Card className="border-4 border-brand-100 bg-white shadow-cartoon-sm">
            <CardContent className="p-6 text-center">
              <div className="mb-4 text-5xl">🛡️</div>
              <h3 className="mb-2 text-xl font-bold text-brand-900">Protected</h3>
              <p className="text-sm text-brand-700">
                Slippage protection, balance validation, and automatic transaction
                rollback keep your funds safe.
              </p>
            </CardContent>
          </Card>

          <Card className="border-4 border-brand-100 bg-white shadow-cartoon-sm">
            <CardContent className="p-6 text-center">
              <div className="mb-4 text-5xl">🚀</div>
              <h3 className="mb-2 text-xl font-bold text-brand-900">Simple</h3>
              <p className="text-sm text-brand-700">
                Launch a token in minutes with just 200 CSPR. We handle deployment,
                distribution, and trading infrastructure.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Technical Details */}
      <section>
        <Card className="border-4 border-brand-100 bg-white shadow-cartoon-pop">
          <CardHeader>
            <h2 className="text-3xl font-bold text-brand-900">Technical Details</h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="mb-3 text-xl font-bold text-brand-800">Token Standard</h3>
              <p className="text-brand-700">
                All tokens are deployed using the <strong>CEP-18</strong> standard (Casper&apos;s
                equivalent of ERC-20). This ensures compatibility with all Casper wallets
                and future DEX integrations.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-xl font-bold text-brand-800">Bonding Curve Mathematics</h3>
              <div className="rounded-lg bg-brand-50 border-2 border-brand-200 p-4 font-mono text-sm">
                <p className="mb-2 text-brand-800">Linear Bonding Curve Formula:</p>
                <p className="text-brand-700">price(supply) = initialPrice + (slope × supply)</p>
                <p className="mt-2 text-xs text-brand-600">
                  Where slope = initialPrice × reserveRatio × 0.0001
                </p>
              </div>
              <p className="mt-3 text-sm text-brand-700">
                This creates a predictable, linear price increase as more tokens are purchased.
                Selling follows the same curve in reverse.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-xl font-bold text-brand-800">Security Features</h3>
              <ul className="space-y-2 text-brand-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span><strong>Rate Limiting:</strong> Prevents spam and abuse</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span><strong>Slippage Protection:</strong> Maximum 10% price impact per trade</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span><strong>Balance Validation:</strong> Prevents overselling</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span><strong>Automatic Rollback:</strong> Failed transactions are reversed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span><strong>Idempotency:</strong> Prevents duplicate trades</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-xl font-bold text-brand-800">Platform Architecture</h3>
              <ol className="space-y-2 pl-5 text-brand-700 list-decimal">
                <li><strong>Token Deployment:</strong> Platform wallet deploys CEP-18 contracts</li>
                <li><strong>Token Distribution:</strong> Automatic transfer of creator&apos;s ownership %</li>
                <li><strong>Bonding Curve:</strong> Manages pricing and liquidity algorithmically</li>
                <li><strong>Trading Engine:</strong> Executes instant buys/sells with blockchain confirmation</li>
                <li><strong>Monitoring:</strong> Real-time health checks and alerting system</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="mb-8 text-center text-3xl font-bold text-brand-900">
          Frequently Asked Questions
        </h2>

        <div className="space-y-4">
          <Card className="border-2 border-brand-200 bg-white">
            <CardHeader>
              <h3 className="text-lg font-bold text-brand-900">
                How much does it cost to launch a project?
              </h3>
            </CardHeader>
            <CardContent>
              <p className="text-brand-700">
                200 CSPR total: 20 CSPR platform fee + 180 CSPR initial liquidity pool.
                The platform pays the token deployment gas (~250 CSPR), so you don&apos;t have to!
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-brand-200 bg-white">
            <CardHeader>
              <h3 className="text-lg font-bold text-brand-900">
                Who owns the tokens after deployment?
              </h3>
            </CardHeader>
            <CardContent>
              <p className="text-brand-700">
                You (the creator) receive your specified ownership percentage directly to your wallet.
                The remaining tokens are held by the platform for bonding curve trading.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-brand-200 bg-white">
            <CardHeader>
              <h3 className="text-lg font-bold text-brand-900">
                Can I sell my creator tokens?
              </h3>
            </CardHeader>
            <CardContent>
              <p className="text-brand-700">
                Yes! Your tokens are real CEP-18 tokens that you fully own. You can sell them
                on the bonding curve just like any other trader.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-brand-200 bg-white">
            <CardHeader>
              <h3 className="text-lg font-bold text-brand-900">
                What happens if a trade fails?
              </h3>
            </CardHeader>
            <CardContent>
              <p className="text-brand-700">
                Our platform has automatic rollback. If a blockchain transaction fails, all
                database changes are reversed, and you&apos;ll receive an error message. Your funds
                remain safe.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-brand-200 bg-white">
            <CardHeader>
              <h3 className="text-lg font-bold text-brand-900">
                Is there a maximum buy/sell amount?
              </h3>
            </CardHeader>
            <CardContent>
              <p className="text-brand-700">
                No hard limit, but slippage protection kicks in at 10% price impact. This means
                very large orders may need to be split into smaller trades to execute successfully.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-brand-200 bg-white">
            <CardHeader>
              <h3 className="text-lg font-bold text-brand-900">
                Can I list my token on other DEXs later?
              </h3>
            </CardHeader>
            <CardContent>
              <p className="text-brand-700">
                Absolutely! Your token is a standard CEP-18 token. You can add liquidity to
                any Casper DEX, create traditional trading pairs, or integrate with other DeFi
                protocols.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center">
        <Card className="border-4 border-brand-500 bg-gradient-to-br from-brand-500 to-brand-600 shadow-cartoon-pop">
          <CardContent className="p-12">
            <h2 className="mb-4 text-4xl font-bold text-white">
              Ready to Launch Your Project?
            </h2>
            <p className="mb-8 text-xl text-brand-100">
              Join the fair launch revolution on Casper blockchain
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/projects/new">
                <button className="rounded-full bg-white px-8 py-4 text-lg font-bold text-brand-600 shadow-cartoon-pop transition-all hover:scale-105 hover:shadow-cartoon-hover">
                  Launch Your Project
                </button>
              </Link>
              <Link href="/projects">
                <button className="rounded-full border-4 border-white bg-transparent px-8 py-4 text-lg font-bold text-white shadow-cartoon-pop transition-all hover:bg-white hover:text-brand-600">
                  Browse Projects
                </button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
