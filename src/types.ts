import { Decimal } from 'decimal.js';

/**
 * Universal market interface - all platforms will be normalized to this shape
 */
export interface StandardMarket {
  id: string;
  platform: 'POLYMARKET' | 'KALSHI' | 'MANIFOLD';
  title: string; // The event question
  outcomes: {
    name: string; // "Yes", "No", "Trump", "Harris"
    price: Decimal; // STORE AS DECIMAL, NOT NUMBER
  }[];
  url: string;
  category?: string; // For pre-filtering during matching
  endDate?: Date; // Market close time
  liquidity?: Decimal; // Total market volume (optional for now)
}

/**
 * Result of matching two markets from different platforms
 */
export interface MarketMatch {
  marketA: StandardMarket;
  marketB: StandardMarket;
  score: number; // 0-100, how confident we are this is the same event
  matchedBy: 'exact' | 'fuzzy' | 'manual'; // How the match was determined
}

/**
 * Fee structure for each platform
 * Different platforms charge different fees - critical for arbitrage profitability
 */
export interface PlatformFees {
  platform: 'POLYMARKET' | 'KALSHI' | 'MANIFOLD';
  tradingFee: Decimal; // Fee charged when buying (e.g., 0.02 = 2%)
  withdrawalFee?: Decimal; // Fee when withdrawing (optional)
  description: string; // Human-readable explanation
}

/**
 * Arbitrage opportunity result
 */
export interface ArbitrageOpportunity {
  marketA: StandardMarket;
  marketB: StandardMarket;
  outcomeA: string; // e.g., "Yes" on Platform A
  outcomeB: string; // e.g., "No" on Platform B
  priceA: Decimal;
  priceB: Decimal;
  totalCost: Decimal; // priceA + priceB (before fees)
  feesA: Decimal; // Fees on platform A
  feesB: Decimal; // Fees on platform B
  totalFees: Decimal; // Total fees across both platforms
  netCost: Decimal; // Total cost after fees
  profitMargin: Decimal; // 1 - netCost
  roi: Decimal; // profitMargin / netCost (as percentage)
  isProfitable: boolean; // True if profit > 0 after fees
  timestamp: Date;
}
