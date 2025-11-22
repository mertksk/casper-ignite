# Casper Ignite — App & Smart Contracts
**App overview:** Casper Ignite is a full-stack platform for launching and trading project tokens on the Casper blockchain. Founders pay platform/liquidity fees in CSPR, deploy a CEP-18 token per project, and investors trade those tokens through on-chain transfers and an in-app order book. The app provides wallet connection, payments, deployment, and trading UIs backed by Prisma/Postgres and Redis. The blockchain layer is real and targets Casper testnet by default. Projects progress from **PRE_MARKET** to **APPROVED** levels; order books, trades, and pricing live off-chain while token deploys/transfers live on-chain.

## Working idea (end-to-end flow)
- **Founder onboarding:** Connect Casper wallet, pay 2000 CSPR total (600 to the platform, 1400 to seed liquidity), and submit project details (title, symbol, supply, ownership %, category, roadmap, funding goal, creator address). Payment deploys are built for wallet signing via `src/lib/casper-payments.ts` (2000 CSPR split), then verified over RPC.
- **Token deployment:** On project creation, `projectService.createProject` calls `deployProjectToken` to push a CEP-18 using `public/contracts/cep18.wasm` and stores both `tokenContractHash` and `tokenPackageHash` plus `tokenStatus`. Projects start at `marketLevel=PRE_MARKET` until cleared/approved.
- **Pricing & liquidity:** Each project gets a bonding-curve record via `bonding-curve-service.initialize` (initial price 0.001 CSPR, reserve ratio 0.5). The liquidity portion of the payment (1400 CSPR) is mirrored in `reserveBalance`, and metrics start at zero with updates driven by orders/trades.
- **Trading lifecycle:** Investors browse/search projects, place limit buy/sell orders (persisted in Postgres). `order-matching-service` runs price-time priority, creates trades with `PENDING` status, and settlement uses CEP-18 transfer helpers in `src/lib/casper.ts` (package hash preferred) with wallet or server signing. Metrics and order books are updated off-chain; token transfers settle on-chain.
- **State progression:** Admin/payment checks move projects from **PRE_MARKET** to **APPROVED**. Off-chain data (orders, price history, metrics, bonding curves) lives in Postgres/Redis; on-chain data is limited to CEP-18 deploys and token/CSPR transfers.

## App structure (Next.js + services)
- **UI & routing:** Next.js App Router in `src/app` with grouped routes for the feed/trading experience (`(feed)`), marketing/landing (`(marketing)`, `about`), admin, project detail pages, and search. Global scaffolding lives in `layout.tsx` and `globals.css`.
- **APIs:** Route handlers in `src/app/api/*` (projects, orders, trades, tokens, payments, search) expose JSON endpoints the UI and background flows consume.
- **Domain services:** `src/server/services` centralizes business logic for project lifecycle and token deploys (`project-service.ts`), bonding-curve pricing/metrics (`bonding-curve-service.ts`), and order matching (`order-matching-service.ts`).
- **Shared libraries:** `src/lib` holds Casper RPC helpers (`casper.ts`, `casperWallet.ts`, `casper-payments.ts`), Prisma connector (`db.ts`), Redis cache helpers (`cache.ts`), DTO/validation (`dto.ts`), config, and rate limiting.
- **Components & hooks:** `src/components` groups feature UIs (projects, trading, payments, feed, admin) plus shared primitives in `ui/`. Global providers live in `src/components/providers.tsx`; wallet integration hook is `src/hooks/useCasperWallet.ts`.
- **Data layer:** Prisma schema/migrations/seeds in `prisma/`, generated client importable via `@prisma/client`, and shared types in `src/types/`.
- **Static & scripts:** `public/contracts/cep18.wasm` is the deployable token WASM; other assets live in `public/`. `scripts/setup-test-env.sh` fetches the WASM and prepares local/test envs.

## CEP-18 Token Contract
- **Standard/Source:** Casper CEP-18 fungible token (`casper-ecosystem/cep18`)
- **Role:** Every project token is a CEP-18; all trade transfers call the project’s CEP-18 contract/package hash.
- **WASM location:** `public/contracts/cep18.wasm` (downloaded by `scripts/setup-test-env.sh` from the official v1.2.0 release).
- **Integration points:** Real deploy/transfer helpers live in `src/lib/casper.ts` and are invoked by `src/server/services/project-service.ts` and trade/payment APIs. Deploys are built with casper-js-sdk v5; server signing uses `CSPR_DEPLOYER_PRIVATE_KEY_PEM` or `CSPR_DEPLOYER_PRIVATE_KEY_HEX` (optionally `CSPR_DEPLOYER_KEY_ALGO`). Deploy flow records both contract hash and contract package hash (package hash is stored on projects for transfers).
- **Network defaults:** RPC env vars target Casper testnet (`CSPR_RPC_URL_PRIMARY`, `CSPR_RPC_URL_FALLBACK`, `NEXT_PUBLIC_CHAIN_NAME=casper-test`). Switch env values to point at mainnet when ready.
- **Safety checks:** Optional `CEP18_WASM_SHA256` env enforces WASM checksum; deploy params validate symbol/decimals/supply before signing.
- **Persistence:** Database stores `tokenContractHash` (first contract hash) and `tokenPackageHash` (preferred for transfers). Trade flows default to the package hash with contract hash as a fallback.

### Notes
- No other custom contracts are used; platform fee and liquidity contributions are native CSPR transfers.
- Ensure projects persist the real CEP-18 contract hash per deployment and that deploy/transfer flows run against live RPC endpoints (no mocks).
