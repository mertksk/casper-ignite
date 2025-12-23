/**
 * Bonding Curve Service
 * Manages token pricing based on a bonding curve model
 *
 * Linear Bonding Curve Formula:
 * price(supply) = initialPrice + (slope × supply)
 *
 * Where:
 * - slope = initialPrice / (totalSupply × reserveRatio)
 * - reserveRatio: determines curve steepness (0-1)
 */

import { prisma } from "@/lib/db";

const LIQUIDITY_CSPR = 180; // Initial liquidity in CSPR (from user's liquidity pool payment)

export interface BondingCurveParams {
  projectId: string;
  initialPrice: number; // Starting price in CSPR
  reserveRatio: number; // Curve steepness (0-1)
  totalSupply: number; // Total token supply
}

export interface PurchaseCalculation {
  tokenAmount: number;
  cost: number; // Cost in CSPR
  newPrice: number; // Price after purchase
  newSupply: number; // Supply after purchase
}

export interface SellCalculation {
  tokenAmount: number;
  proceeds: number; // Proceeds in CSPR
  newPrice: number; // Price after sell
  newSupply: number; // Supply after sell
}

class BondingCurveService {
  /**
   * Initialize bonding curve for a new project
   */
  async initialize(params: BondingCurveParams): Promise<void> {
    const { projectId, initialPrice, reserveRatio, totalSupply } = params;

    await prisma.bondingCurve.create({
      data: {
        projectId,
        initialPrice,
        reserveRatio,
        currentSupply: 0, // Start with 0 sold
        reserveBalance: LIQUIDITY_CSPR, // Initial liquidity from 2000 CSPR payment
      },
    });

    // Update project metrics with initial values
    // CSPR price ~$0.02 for liquidity USD estimate
    const csprPriceUsd = 0.02;
    const liquidityUsd = LIQUIDITY_CSPR * csprPriceUsd;
    const initialMarketCap = initialPrice * totalSupply * csprPriceUsd;

    await prisma.projectMetric.update({
      where: { projectId },
      data: {
        currentPrice: initialPrice,
        liquidityUsd,
        marketCap: initialMarketCap,
      },
    });
  }

  /**
   * Get current price for buying 1 token
   */
  async getCurrentPrice(projectId: string): Promise<number> {
    const curve = await prisma.bondingCurve.findUnique({
      where: { projectId },
    });

    if (!curve) {
      throw new Error("Bonding curve not found for project");
    }

    return this.calculatePrice(
      curve.initialPrice,
      curve.reserveRatio,
      curve.currentSupply
    );
  }

  /**
   * Calculate cost to purchase tokens
   */
  async calculatePurchase(
    projectId: string,
    tokenAmount: number
  ): Promise<PurchaseCalculation> {
    const curve = await prisma.bondingCurve.findUnique({
      where: { projectId },
    });

    if (!curve) {
      throw new Error("Bonding curve not found for project");
    }

    // For linear curve: integrate from currentSupply to currentSupply + tokenAmount
    // Cost = ∫ (initialPrice + slope × s) ds
    const slope = this.calculateSlope(curve.initialPrice, curve.reserveRatio);
    const { currentSupply, initialPrice } = curve;

    // Integration: initialPrice × amount + slope × (supply² - (supply + amount)²) / 2
    const cost =
      initialPrice * tokenAmount +
      (slope *
        (Math.pow(currentSupply + tokenAmount, 2) - Math.pow(currentSupply, 2))) /
        2;

    const newSupply = currentSupply + tokenAmount;
    const newPrice = this.calculatePrice(initialPrice, curve.reserveRatio, newSupply);

    return {
      tokenAmount,
      cost,
      newPrice,
      newSupply,
    };
  }

  /**
   * Calculate proceeds from selling tokens
   */
  async calculateSell(
    projectId: string,
    tokenAmount: number
  ): Promise<SellCalculation> {
    const curve = await prisma.bondingCurve.findUnique({
      where: { projectId },
    });

    if (!curve) {
      throw new Error("Bonding curve not found for project");
    }

    if (curve.currentSupply < tokenAmount) {
      throw new Error("Insufficient tokens in circulation");
    }

    const slope = this.calculateSlope(curve.initialPrice, curve.reserveRatio);
    const { currentSupply, initialPrice } = curve;

    // Integration: same formula but subtract
    const proceeds =
      initialPrice * tokenAmount +
      (slope *
        (Math.pow(currentSupply, 2) - Math.pow(currentSupply - tokenAmount, 2))) /
        2;

    const newSupply = currentSupply - tokenAmount;
    const newPrice = this.calculatePrice(initialPrice, curve.reserveRatio, newSupply);

    return {
      tokenAmount,
      proceeds,
      newPrice,
      newSupply,
    };
  }

  /**
   * Execute a token purchase and update the curve
   */
  async executePurchase(
    projectId: string,
    tokenAmount: number
  ): Promise<PurchaseCalculation> {
    // Get current price BEFORE updating anything
    const currentPrice = await this.getCurrentPrice(projectId);

    const calculation = await this.calculatePurchase(projectId, tokenAmount);

    // Update bonding curve
    await prisma.bondingCurve.update({
      where: { projectId },
      data: {
        currentSupply: calculation.newSupply,
        reserveBalance: {
          increment: calculation.cost,
        },
      },
    });

    // Update project metrics
    await prisma.projectMetric.update({
      where: { projectId },
      data: {
        currentPrice: calculation.newPrice,
        marketCap: {
          increment: calculation.cost,
        },
        totalInvestors: {
          increment: 1,
        },
      },
    });

    // Add price history entry for the trade
    // For instant trades, we'll create a 1-minute candle with the trade price
    await prisma.priceHistory.create({
      data: {
        projectId,
        open: currentPrice,
        high: Math.max(currentPrice, calculation.newPrice),
        low: Math.min(currentPrice, calculation.newPrice),
        close: calculation.newPrice,
        volume: tokenAmount,
        timestamp: new Date(),
        interval: "1m",
      },
    });

    return calculation;
  }

  /**
   * Execute a token sale and update the curve
   */
  async executeSell(
    projectId: string,
    tokenAmount: number
  ): Promise<SellCalculation> {
    // Get current price BEFORE updating anything
    const currentPrice = await this.getCurrentPrice(projectId);

    const calculation = await this.calculateSell(projectId, tokenAmount);
    const curve = await prisma.bondingCurve.findUnique({
      where: { projectId },
    });

    if (!curve || curve.reserveBalance < calculation.proceeds) {
      throw new Error("Insufficient reserve balance");
    }

    // Update bonding curve
    await prisma.bondingCurve.update({
      where: { projectId },
      data: {
        currentSupply: calculation.newSupply,
        reserveBalance: {
          decrement: calculation.proceeds,
        },
      },
    });

    // Update project metrics
    await prisma.projectMetric.update({
      where: { projectId },
      data: {
        currentPrice: calculation.newPrice,
        marketCap: {
          decrement: calculation.proceeds,
        },
      },
    });

    // Add price history entry for the trade
    await prisma.priceHistory.create({
      data: {
        projectId,
        open: currentPrice,
        high: Math.max(currentPrice, calculation.newPrice),
        low: Math.min(currentPrice, calculation.newPrice),
        close: calculation.newPrice,
        volume: tokenAmount,
        timestamp: new Date(),
        interval: "1m",
      },
    });

    return calculation;
  }

  /**
   * Get instant buy quote (for UI preview)
   */
  async getInstantBuyQuote(projectId: string, tokenAmount: number) {
    if (tokenAmount <= 0) {
      throw new Error("Token amount must be positive");
    }

    const calculation = await this.calculatePurchase(projectId, tokenAmount);
    const currentPrice = await this.getCurrentPrice(projectId);

    return {
      tokenAmount,
      cost: calculation.cost,
      pricePerToken: calculation.cost / tokenAmount,
      currentPrice,
      newPrice: calculation.newPrice,
      priceImpact: ((calculation.newPrice - currentPrice) / currentPrice) * 100,
    };
  }

  /**
   * Get instant sell quote (for UI preview)
   */
  async getInstantSellQuote(projectId: string, tokenAmount: number) {
    if (tokenAmount <= 0) {
      throw new Error("Token amount must be positive");
    }

    const calculation = await this.calculateSell(projectId, tokenAmount);
    const currentPrice = await this.getCurrentPrice(projectId);

    return {
      tokenAmount,
      payout: calculation.proceeds,
      pricePerToken: calculation.proceeds / tokenAmount,
      currentPrice,
      newPrice: calculation.newPrice,
      priceImpact: ((currentPrice - calculation.newPrice) / currentPrice) * 100,
    };
  }

  /**
   * Get bonding curve information
   */
  async getCurveInfo(projectId: string) {
    const curve = await prisma.bondingCurve.findUnique({
      where: { projectId },
      include: {
        project: {
          select: {
            title: true,
            tokenSymbol: true,
            tokenSupply: true,
          },
        },
      },
    });

    if (!curve) {
      throw new Error("Bonding curve not found");
    }

    const currentPrice = this.calculatePrice(
      curve.initialPrice,
      curve.reserveRatio,
      curve.currentSupply
    );

    const slope = this.calculateSlope(curve.initialPrice, curve.reserveRatio);

    return {
      ...curve,
      currentPrice,
      slope,
      supplyPercent: (curve.currentSupply / curve.project.tokenSupply) * 100,
    };
  }

  /**
   * Calculate price at a given supply level
   */
  private calculatePrice(
    initialPrice: number,
    reserveRatio: number,
    supply: number
  ): number {
    const slope = this.calculateSlope(initialPrice, reserveRatio);
    return initialPrice + slope * supply;
  }

  /**
   * Calculate slope for the linear curve
   */
  private calculateSlope(initialPrice: number, reserveRatio: number): number {
    // For linear curve, slope determines how quickly price increases
    // Lower reserveRatio = steeper curve = faster price growth
    return initialPrice * reserveRatio * 0.0001; // Adjust multiplier as needed
  }
}

export const bondingCurveService = new BondingCurveService();
