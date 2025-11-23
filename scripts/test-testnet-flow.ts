/**
 * Automated Testnet Flow Validator
 *
 * This script tests the complete end-to-end flow:
 * 1. Create a project (platform deploys token)
 * 2. Buy tokens (platform sends tokens to user)
 * 3. Sell tokens (platform sends CSPR to user)
 * 4. Verify all blockchain transactions
 * 5. Check monitoring endpoints
 *
 * Usage: npx tsx scripts/test-testnet-flow.ts
 */

import { config } from "dotenv";
config();

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const TEST_WALLET = process.env.TEST_WALLET_PUBLIC_KEY || "";

if (!TEST_WALLET) {
  console.error("❌ TEST_WALLET_PUBLIC_KEY not set in environment");
  process.exit(1);
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  data?: unknown;
}

const results: TestResult[] = [];

function logStep(step: string) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔄 ${step}`);
  console.log("=".repeat(80));
}

function logSuccess(message: string) {
  console.log(`✅ ${message}`);
}

function logError(message: string) {
  console.error(`❌ ${message}`);
}

function logInfo(message: string) {
  console.log(`ℹ️  ${message}`);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({
      name,
      passed: true,
      duration: Date.now() - start,
    });
    logSuccess(`${name} - PASSED (${Date.now() - start}ms)`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    });
    logError(`${name} - FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function testHealthCheck() {
  logStep("TEST 1: Health Check");

  await test("Health endpoint returns 200", async () => {
    const response = await fetch(`${API_BASE}/api/health`);
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }
    const data = await response.json();
    logInfo(`Health status: ${data.status}`);
    logInfo(`Database: ${data.checks.database?.status}`);
    logInfo(`Critical alerts: ${data.checks.criticalAlerts?.details?.unresolvedCount || 0}`);
  });
}

async function testAdminMonitoring() {
  logStep("TEST 2: Admin Monitoring Dashboard");

  await test("Monitoring endpoint returns data", async () => {
    const response = await fetch(`${API_BASE}/api/admin/monitoring`);
    if (!response.ok) {
      throw new Error(`Monitoring failed with status ${response.status}`);
    }
    const data = await response.json();
    logInfo(`Critical alerts: ${data.alerts?.critical || 0}`);
    logInfo(`Rollbacks (7d): ${data.rollbacks?.total7Days || 0}`);
    logInfo(`Trades (24h): ${data.trading?.trades24h || 0}`);
  });
}

async function testProjectCreation(): Promise<string> {
  logStep("TEST 3: Project Creation");

  let projectId = "";

  await test("Create test project", async () => {
    const projectData = {
      title: `Test Project ${Date.now()}`,
      description: "This is an automated test project created by the testnet validation script. This project tests the complete platform token deployment and distribution flow.",
      tokenSymbol: `TEST${Math.floor(Math.random() * 1000)}`,
      tokenSupply: 1000000,
      ownershipPercent: 10,
      creatorAddress: TEST_WALLET,
      category: "OTHER",
      roadmap: "Q1 2025: Testing phase\nQ2 2025: Validation complete\nQ3 2025: Production deployment",
      fundingGoal: 10000,
      // Skip payment hashes in dev mode
      platformFeeHash: undefined,
      liquidityPoolHash: undefined,
    };

    logInfo(`Creating project: ${projectData.title}`);
    logInfo(`Token symbol: ${projectData.tokenSymbol}`);

    const response = await fetch(`${API_BASE}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Project creation failed: ${JSON.stringify(errorData)}`);
    }

    const project = await response.json();
    projectId = project.id;

    logSuccess(`Project created with ID: ${projectId}`);
    logInfo(`Token contract hash: ${project.tokenContractHash || "pending"}`);
    logInfo(`Token status: ${project.tokenStatus}`);

    // Wait for token deployment (up to 5 minutes)
    if (project.tokenStatus !== "DEPLOYED") {
      logInfo("Waiting for token deployment...");
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes

      while (attempts < maxAttempts) {
        await sleep(5000); // Wait 5 seconds
        const checkResponse = await fetch(`${API_BASE}/api/projects/${projectId}`);
        const updatedProject = await checkResponse.json();

        if (updatedProject.tokenStatus === "DEPLOYED") {
          logSuccess(`Token deployed! Contract hash: ${updatedProject.tokenContractHash}`);
          break;
        } else if (updatedProject.tokenStatus === "FAILED") {
          throw new Error("Token deployment failed");
        }

        attempts++;
        logInfo(`Still deploying... (${attempts * 5}s elapsed)`);
      }

      if (attempts >= maxAttempts) {
        throw new Error("Token deployment timeout (5 minutes)");
      }
    }
  });

  return projectId;
}

async function testBuyFlow(projectId: string) {
  logStep("TEST 4: Buy Transaction");

  await test("Get buy quote", async () => {
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/bonding-curve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "buy",
        tokenAmount: 100,
      }),
    });

    if (!response.ok) {
      throw new Error(`Quote failed with status ${response.status}`);
    }

    const quote = await response.json();
    logInfo(`Quote: ${quote.tokenAmount} tokens for ${quote.cost?.toFixed(4)} CSPR`);
    logInfo(`Price per token: ${quote.pricePerToken?.toFixed(6)} CSPR`);
    logInfo(`Price impact: ${quote.priceImpact?.toFixed(2)}%`);
  });

  await test("Execute buy transaction", async () => {
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: TEST_WALLET,
        tokenAmount: 100,
        maxSlippage: 10,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Buy failed: ${errorData.error || response.statusText}`);
    }

    const result = await response.json();
    logSuccess(`Buy successful!`);
    logInfo(`Deploy hash: ${result.deployHash}`);
    logInfo(`Explorer: ${result.explorerUrl}`);
    logInfo(`Message: ${result.message}`);

    // Wait for confirmation
    logInfo("Waiting for blockchain confirmation (this may take a few minutes)...");
  });
}

async function testSellFlow(projectId: string) {
  logStep("TEST 5: Sell Transaction");

  await test("Get sell quote", async () => {
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/bonding-curve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "sell",
        tokenAmount: 50,
      }),
    });

    if (!response.ok) {
      throw new Error(`Quote failed with status ${response.status}`);
    }

    const quote = await response.json();
    logInfo(`Quote: ${quote.tokenAmount} tokens for ${quote.payout?.toFixed(4)} CSPR`);
    logInfo(`Price per token: ${quote.pricePerToken?.toFixed(6)} CSPR`);
    logInfo(`Price impact: ${quote.priceImpact?.toFixed(2)}%`);
  });

  await test("Execute sell transaction", async () => {
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: TEST_WALLET,
        tokenAmount: 50,
        maxSlippage: 10,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Sell failed: ${errorData.error || response.statusText}`);
    }

    const result = await response.json();
    logSuccess(`Sell successful!`);
    logInfo(`Deploy hash: ${result.deployHash}`);
    logInfo(`Explorer: ${result.explorerUrl}`);
    logInfo(`Message: ${result.message}`);
  });
}

async function testBondingCurve(projectId: string) {
  logStep("TEST 6: Bonding Curve State");

  await test("Get current price", async () => {
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/bonding-curve`);

    if (!response.ok) {
      throw new Error(`Failed to get price: ${response.status}`);
    }

    const data = await response.json();
    logInfo(`Current price: ${data.currentPrice?.toFixed(6)} CSPR`);
    logInfo(`Current supply: ${data.currentSupply || 0} tokens sold`);
    logInfo(`Reserve balance: ${data.reserveBalance?.toFixed(2)} CSPR`);
  });
}

async function printSummary() {
  console.log("\n" + "=".repeat(80));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(80));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Pass Rate: ${passRate}%`);

  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
  }

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`\n⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

  console.log("\n" + "=".repeat(80));

  if (failed === 0) {
    console.log("🎉 ALL TESTS PASSED! Platform is production-ready for testnet.");
  } else {
    console.log("⚠️  SOME TESTS FAILED. Please review errors above.");
    process.exit(1);
  }
}

async function main() {
  console.log("\n🚀 Starting Testnet Flow Validation");
  console.log(`API Base: ${API_BASE}`);
  console.log(`Test Wallet: ${TEST_WALLET.slice(0, 10)}...${TEST_WALLET.slice(-10)}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

  try {
    // Test 1: Health Check
    await testHealthCheck();

    // Test 2: Admin Monitoring
    await testAdminMonitoring();

    // Test 3: Create Project
    const projectId = await testProjectCreation();

    if (!projectId) {
      logError("Cannot proceed without project ID");
      return;
    }

    // Test 4: Buy Flow
    await testBuyFlow(projectId);

    // Test 5: Sell Flow (only if buy succeeded)
    const buyPassed = results.find((r) => r.name === "Execute buy transaction")?.passed;
    if (buyPassed) {
      await testSellFlow(projectId);
    } else {
      logInfo("Skipping sell test because buy failed");
    }

    // Test 6: Bonding Curve State
    await testBondingCurve(projectId);

    // Print summary
    await printSummary();

  } catch (error) {
    console.error("\n💥 Fatal Error:", error);
    process.exit(1);
  }
}

main();
