# Quick Vercel Deployment Steps

## 🚀 5-Minute Deployment Guide

### 1. Prepare Database & Redis

**Get PostgreSQL Database:**
- **Vercel Postgres**: Vercel Dashboard → Storage → Create Postgres Database
- **OR Neon**: https://neon.tech (Free tier available)
- **OR Supabase**: https://supabase.com (Free tier available)

**Get Redis:**
- **Upstash Redis**: https://upstash.com (Free tier available, best for Vercel)

### 2. Generate JWT Secret

```bash
openssl rand -base64 32
```
Copy the output - you'll need it for environment variables.

### 3. Deploy to Vercel

**Via Dashboard:**
1. Go to https://vercel.com/new
2. Import GitHub repo: `mertksk/casper-ignite`
3. Add environment variables (see below)
4. Click "Deploy"

**Via CLI:**
```bash
npm i -g vercel
vercel login
vercel
```

### 4. Environment Variables for Vercel

Add these in Vercel Dashboard → Settings → Environment Variables:

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=Casper Ignite
NEXT_PUBLIC_CHAIN_NAME=casper-test
CSPR_RPC_URL_PRIMARY=https://node.testnet.casper.network/rpc
CSPR_RPC_URL_FALLBACK=https://node.testnet.casper.network/rpc
DATABASE_URL=<your-postgres-url-with-?sslmode=require>
REDIS_URL=<your-redis-url>
JWT_SECRET=<generated-secret-from-step-2>
SMTP_URL=smtp://user:pass@smtp.server:587
```

### 5. Run Migrations

```bash
# Pull production env vars
vercel env pull .env.production

# Run migrations
DATABASE_URL="<your-production-db-url>" npx prisma migrate deploy
```

### 6. Seed Database (Optional)

```bash
DATABASE_URL="<your-production-db-url>" npm run db:seed
```

---

## ✅ Verification Checklist

After deployment:
- [ ] Site loads at your Vercel URL
- [ ] No console errors
- [ ] Wallet connection works
- [ ] Projects display (if seeded)
- [ ] Can create new projects (test)

---

## 🔥 Common Quick Fixes

**Build fails?**
```bash
# Make sure these are in package.json:
"postinstall": "prisma generate"
"build": "prisma generate && next build"
```

**Database errors?**
- Add `?sslmode=require` to DATABASE_URL
- Check database is publicly accessible

**Redis errors?**
- Use Upstash Redis for Vercel
- Check REDIS_URL format

---

## 📞 Need Help?

See full guide: `VERCEL_DEPLOY.md`
