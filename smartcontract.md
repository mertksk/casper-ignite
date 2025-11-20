# Casper Ignite — App & Smart Contracts
**App overview:** Casper Ignite is a full-stack platform for launching and trading project tokens on the Casper blockchain. Founders pay platform/liquidity fees in CSPR, deploy a CEP-18 token per project, and investors trade those tokens through on-chain transfers and an in-app order book. The app provides wallet connection, payments, deployment, and trading UIs backed by Prisma/Postgres and Redis. The blockchain layer is real and targets Casper testnet by default. Projects progress from **PRE_MARKET** to **APPROVED** levels; order books, trades, and pricing live off-chain while token deploys/transfers live on-chain.

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
