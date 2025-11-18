# Casper Ignite

A Next.js application for managing Casper blockchain projects with token management, metrics tracking, and order processing.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v20 or higher recommended)
- **npm**, **yarn**, **pnpm**, or **bun** package manager
- **PostgreSQL** (v14 or higher)
- **Redis** (v6 or higher)

## Getting Started

Follow these steps to set up the application from scratch:

### 1. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

### 2. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and update the following variables:

```env
# Database - Update with your PostgreSQL credentials
DATABASE_URL="postgresql://user:password@localhost:5432/casper_radar"

# Redis - Update if your Redis is running on a different host/port
REDIS_URL="redis://localhost:6379"

# Security - Generate a secure JWT secret
JWT_SECRET="your-secure-secret-here"

# Other variables can be left as default or customized as needed
```

### 3. Set Up the Database

Run the following Prisma commands to set up your database:

```bash
# Generate Prisma Client
npm run prisma:generate
# or
npx prisma generate

# Run database migrations
npm run prisma:migrate
# or
npx prisma migrate dev

# Seed the database with initial data (optional)
npm run db:seed
# or
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

### 4. Start the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run db:seed` - Seed the database with initial data

## Project Structure

- `/src` - Application source code
- `/prisma` - Database schema and migrations
- `/public` - Static assets
- `/src/generated/prisma` - Generated Prisma Client

## Tech Stack

- **Framework**: Next.js 15
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **UI**: Tailwind CSS, Radix UI
- **State Management**: TanStack Query
- **Forms**: React Hook Form with Zod validation
- **Blockchain**: Casper JS SDK

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Casper Network](https://casper.network)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
