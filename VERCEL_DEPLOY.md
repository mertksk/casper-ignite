# Vercel Deployment Guide for Casper Ignite

## Prerequisites

Before deploying to Vercel, ensure you have:
- A [Vercel account](https://vercel.com/signup)
- A PostgreSQL database (Vercel Postgres, Neon, Supabase, or any other provider)
- A Redis instance (Upstash Redis recommended for Vercel)
- Your GitHub repository connected to Vercel

---

## Step 1: Set Up Database & Redis

### Option A: Use Vercel Postgres & Upstash Redis (Recommended)

1. **Vercel Postgres**:
   - Go to your Vercel dashboard
   - Navigate to Storage → Create Database → Postgres
   - Copy the `DATABASE_URL` connection string

2. **Upstash Redis**:
   - Go to [Upstash Console](https://console.upstash.com/)
   - Create a new Redis database
   - Copy the connection string (starts with `redis://` or `rediss://`)

### Option B: Use External Providers

- **PostgreSQL**: Neon, Supabase, Railway, or any PostgreSQL provider
- **Redis**: Upstash, Redis Cloud, or any Redis provider

---

## Step 2: Configure Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and add:

### Required Variables

```bash
# Node Environment
NODE_ENV=production

# App Configuration
NEXT_PUBLIC_APP_NAME=Casper Ignite
NEXT_PUBLIC_CHAIN_NAME=casper-test

# Casper RPC (Testnet)
CSPR_RPC_URL_PRIMARY=https://node.testnet.casper.network/rpc
CSPR_RPC_URL_FALLBACK=https://node.testnet.casper.network/rpc

# Database (from Vercel Postgres or your provider)
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# Redis (from Upstash or your provider)
REDIS_URL=redis://username:password@host:port

# Security - GENERATE A STRONG SECRET!
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long-random-string

# Email (optional, for future use)
SMTP_URL=smtp://user:pass@smtp.server:587
```

### Important Notes:

1. **JWT_SECRET**: Generate a strong random string:
   ```bash
   openssl rand -base64 32
   ```

2. **DATABASE_URL**: Must include `?sslmode=require` for production databases

3. **REDIS_URL**: Use the connection string from your Redis provider

4. **Chain Selection**:
   - Use `casper-test` for testnet (recommended for initial deployment)
   - Use `casper-mainnet` for production (requires updating RPC URLs too)

---

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your GitHub repository: `mertksk/casper-ignite`
4. Configure build settings (should auto-detect Next.js):
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`
5. Add all environment variables from Step 2
6. Click "Deploy"

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# For production deployment
vercel --prod
```

---

## Step 4: Run Database Migrations

After your first deployment, you need to run Prisma migrations:

### Method 1: Using Vercel CLI (Recommended)

```bash
# Connect to your Vercel project
vercel env pull .env.production

# Run migrations
DATABASE_URL="your-production-database-url" npx prisma migrate deploy
```

### Method 2: Using a Build Script

Add this to your `package.json` scripts (already added):
```json
"prisma:migrate:deploy": "prisma migrate deploy"
```

Then create a Vercel Build Command override:
```bash
prisma migrate deploy && next build
```

### Method 3: Manual SQL Execution

1. Connect to your production database using a SQL client
2. Run the migration SQL files from `prisma/migrations/` manually

---

## Step 5: Seed the Database (Optional)

If you want to populate your production database with sample data:

```bash
# Using your production DATABASE_URL
DATABASE_URL="your-production-database-url" npm run db:seed
```

**Warning**: Only seed on a fresh database. Don't seed production data!

---

## Step 6: Verify Deployment

1. Visit your Vercel deployment URL (e.g., `https://casper-ignite.vercel.app`)
2. Check that:
   - ✅ Homepage loads correctly
   - ✅ Projects are displayed (if you seeded data)
   - ✅ Casper Wallet connection works
   - ✅ Database queries work (check browser console for errors)
   - ✅ Redis caching works (check response times)

---

## Common Issues & Solutions

### Issue 1: "Prisma Client not generated"
**Solution**: Make sure `postinstall` script is in package.json:
```json
"postinstall": "prisma generate"
```

### Issue 2: Database connection errors
**Solution**:
- Verify `DATABASE_URL` includes `?sslmode=require`
- Check database is accessible from Vercel's IP range
- Ensure connection pooling is enabled for serverless

### Issue 3: Redis connection timeouts
**Solution**:
- Use Upstash Redis (optimized for serverless)
- Increase connection timeout in your Redis client configuration

### Issue 4: Build fails with "Cannot find module @prisma/client"
**Solution**: Run `prisma generate` before build (already configured)

### Issue 5: Environment variables not working
**Solution**:
- Prefix public vars with `NEXT_PUBLIC_`
- Redeploy after adding new env vars
- Check variable names match exactly (case-sensitive)

---

## Production Checklist

Before going to production:

- [ ] Update `NEXT_PUBLIC_CHAIN_NAME` to `casper-mainnet` (if ready)
- [ ] Update `CSPR_RPC_URL_PRIMARY` and `CSPR_RPC_URL_FALLBACK` to mainnet URLs
- [ ] Generate a strong `JWT_SECRET` (min 32 characters)
- [ ] Enable database connection pooling
- [ ] Set up monitoring (Vercel Analytics, Sentry, etc.)
- [ ] Configure custom domain
- [ ] Enable Vercel Edge Functions (if needed)
- [ ] Set up backup strategy for database
- [ ] Review and test all API routes
- [ ] Enable rate limiting in production
- [ ] Review security settings

---

## Environment URLs

After deployment, you'll have:
- **Production**: `https://casper-ignite.vercel.app` (or your custom domain)
- **Preview**: Automatic preview URLs for each git branch
- **Development**: `http://localhost:3001`

---

## Updating Environment Variables

To update environment variables after deployment:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update the variable
3. Redeploy your project (Vercel will auto-redeploy if you push to git)

Or via CLI:
```bash
vercel env add JWT_SECRET production
vercel env ls
```

---

## Monitoring & Logs

- **Logs**: Vercel Dashboard → Your Project → Logs
- **Analytics**: Vercel Dashboard → Your Project → Analytics
- **Errors**: Check browser console and Vercel function logs

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Review this guide
3. Check [Vercel Documentation](https://vercel.com/docs)
4. Check [Prisma Vercel Deployment Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
