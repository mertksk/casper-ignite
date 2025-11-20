# Testnet Deployment Checklist

Quick reference checklist for deploying Casper Ignite to testnet.

## Pre-Deployment

- [ ] Node.js 18+ installed
- [ ] PostgreSQL running
- [ ] Casper Wallet extension installed
- [ ] Testnet wallet created in Casper Wallet
- [ ] Testnet CSPR obtained from faucet (minimum 2500 CSPR recommended)

## Environment Setup

- [ ] `.env` file created from `.env.example`
- [ ] `NODE_ENV` set to `development` or `production`
- [ ] `NEXT_PUBLIC_CHAIN_NAME` set to `casper-test`
- [ ] `CSPR_RPC_URL_PRIMARY` set to testnet RPC
- [ ] `DATABASE_URL` configured for testnet database
- [ ] `PLATFORM_FEE_ADDRESS` updated with real testnet wallet public key
- [ ] `LIQUIDITY_POOL_ADDRESS` updated with real testnet wallet public key

## Database

- [ ] Run `npm run prisma:migrate` to apply schema
- [ ] Run `npx prisma generate` to generate client
- [ ] Verify database connection: `npx prisma db pull`
- [ ] Check tables created: Project, ProjectOrder, Trade, User

## Application Files

- [ ] CEP-18 WASM contract exists at `public/contracts/cep18.wasm`
- [ ] WASM file size is ~195KB (not 9 bytes)
- [ ] Dependencies installed: `npm install`
- [ ] Build succeeds: `npm run build`

## Code Verification

- [ ] `src/lib/casper.ts` - `createTokenDeployParams()` loads WASM from filesystem
- [ ] `src/lib/config.ts` - Platform addresses configured from environment
- [ ] `src/app/api/projects/route.ts` - Payment verification logic enabled for production
- [ ] `src/middleware.ts` - CSP includes `unsafe-inline unsafe-eval` for wallet
- [ ] `src/hooks/useCasperWallet.ts` - Retry mechanism implemented

## Testing

### Wallet Connection
- [ ] Start dev server: `npm run dev`
- [ ] Navigate to http://localhost:3000
- [ ] Click "Connect Wallet"
- [ ] Wallet connects within 3 seconds
- [ ] No CSP errors in browser console
- [ ] Wallet address displays correctly

### Project Creation
- [ ] Click "Create Project"
- [ ] Fill all required fields (title, description, token symbol, etc.)
- [ ] Payment flow appears
- [ ] Platform fee payment (600 CSPR) succeeds
- [ ] Deploy confirms on blockchain (~2 minutes)
- [ ] Liquidity pool payment (1400 CSPR) succeeds
- [ ] Deploy confirms on blockchain (~2 minutes)
- [ ] Token deployment transaction created
- [ ] User signs deploy in wallet
- [ ] Token deployment confirms (~3 minutes)
- [ ] Project appears in database
- [ ] Contract hash saved to project record

### Order Placement
- [ ] Navigate to project detail page
- [ ] Place BUY order (e.g., 100 tokens at 0.5 CSPR)
- [ ] Order appears in "My Orders"
- [ ] Order status is "OPEN"
- [ ] Order appears in order book (buy side)

### Order Matching
- [ ] Place SELL order with matching/lower price
- [ ] Trade automatically created
- [ ] Trade appears in "Recent Trades"
- [ ] Execute trade button appears
- [ ] Click "Execute Trade"
- [ ] Review trade details
- [ ] Sign token transfer in wallet
- [ ] Trade confirms on blockchain
- [ ] Order statuses update correctly
- [ ] Trade status changes to "CONFIRMED"

## Blockchain Verification

- [ ] Platform fee deploy visible on https://testnet.cspr.live
- [ ] Liquidity pool deploy visible on explorer
- [ ] Token deployment deploy visible on explorer
- [ ] Token contract hash searchable on explorer
- [ ] Contract shows CEP-18 standard
- [ ] Token transfer deploys confirm successfully
- [ ] All deploys show "Success" status

## Security

- [ ] Platform wallet private keys secured (not in code)
- [ ] `.env` file in `.gitignore`
- [ ] No hardcoded secrets in repository
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Input validation on all API endpoints
- [ ] SQL injection protected (Prisma parameterized queries)

## Performance

- [ ] Order matching completes in < 500ms
- [ ] Order book query returns in < 200ms
- [ ] No N+1 query issues in logs
- [ ] Database indexes on foreign keys
- [ ] Pagination implemented for large result sets

## Monitoring

- [ ] Server logs accessible
- [ ] Error tracking configured (optional)
- [ ] Database connection pool monitored
- [ ] API response times logged

## Documentation

- [ ] README.md updated with project description
- [ ] TESTNET_DEPLOYMENT.md reviewed
- [ ] API endpoints documented
- [ ] Known issues documented

## Production Readiness (For Mainnet)

- [ ] All tests passing on testnet
- [ ] Security audit completed
- [ ] Gas costs calculated and acceptable
- [ ] Platform wallets funded with sufficient CSPR
- [ ] Backup and recovery procedures documented
- [ ] Monitoring and alerting configured
- [ ] Rate limiting tuned for production load
- [ ] `NODE_ENV=production` set
- [ ] Mainnet RPC URLs configured
- [ ] Database backups scheduled

## Common Issues Resolved

- [ ] Wallet detection timeout → Fixed with retry mechanism
- [ ] CSP blocking wallet → Fixed with unsafe-inline/eval
- [ ] Database drift → Fixed with migrate reset
- [ ] WASM file too small → Fixed with correct download URL
- [ ] Payment verification blocking dev → Fixed with dev mode bypass

## Post-Deployment

- [ ] Monitor first 10 project creations
- [ ] Monitor first 20 trades
- [ ] Verify platform fee wallet receives payments
- [ ] Verify liquidity pool wallet receives payments
- [ ] Check for failed deploys
- [ ] Review error logs
- [ ] Gather user feedback
- [ ] Document any issues encountered

## Rollback Procedure

If critical issues arise:

1. [ ] Stop application server
2. [ ] Switch DNS/load balancer to maintenance page
3. [ ] Identify root cause from logs
4. [ ] Revert to previous working commit if needed
5. [ ] Database: Restore from backup if necessary
6. [ ] Redeploy stable version
7. [ ] Verify functionality with test transactions
8. [ ] Switch traffic back to application
9. [ ] Post-mortem: Document what went wrong

## Success Criteria

Deployment is successful when:

- [ ] 5+ projects created successfully with real blockchain tokens
- [ ] 10+ orders placed without errors
- [ ] 5+ trades executed and confirmed on blockchain
- [ ] No critical errors in logs for 24 hours
- [ ] All deployed hashes confirm on testnet explorer
- [ ] User feedback is positive
- [ ] Platform wallets received all fees correctly
- [ ] Token balances update correctly after trades

## Team Sign-Off

- [ ] Developer: Code review complete, tests passing
- [ ] QA: All test scenarios passed on testnet
- [ ] DevOps: Infrastructure ready, monitoring configured
- [ ] Product: User flows tested, UX acceptable
- [ ] Security: No critical vulnerabilities identified
- [ ] Project Owner: Ready for testnet user testing

---

**Date Prepared:** 2025-01-19
**Target Deployment:** Casper Testnet
**Version:** 1.0.0
**Next Review:** After first week of testing
