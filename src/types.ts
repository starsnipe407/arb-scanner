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
 * Arbitrage opportunity result
 */
export interface ArbitrageOpportunity {
  marketA: StandardMarket;
  marketB: StandardMarket;
  outcomeA: string; // e.g., "Yes" on Platform A
  outcomeB: string; // e.g., "No" on Platform B
  priceA: Decimal;
  priceB: Decimal;
  totalCost: Decimal; // priceA + priceB
  profitMargin: Decimal; // 1 - totalCost
  roi: Decimal; // profitMargin / totalCost
  timestamp: Date;
}
