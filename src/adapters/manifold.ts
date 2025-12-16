import axios from 'axios';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { StandardMarket } from '../types.js';

/**
 * Zod schema for Manifold Markets API response validation
 * 
 * KEY DIFFERENCES FROM POLYMARKET:
 * - Manifold returns "probability" as a decimal (0-1), not separate outcome prices
 * - We need to calculate: Yes price = probability, No price = 1 - probability
 * - "outcomeType" tells us if it's binary (Yes/No) or multi-choice
 */
const ManifoldMarketSchema = z.object({
  id: z.string(),
  question: z.string(), // The market question
  url: z.string(),
  closeTime: z.number().optional(), // Unix timestamp in milliseconds
  outcomeType: z.string(), // "BINARY", "MULTIPLE_CHOICE", "FREE_RESPONSE", etc.
  probability: z.number().optional(), // For binary markets: 0.0 to 1.0
  isResolved: z.boolean(),
  volume: z.number().optional(),
  totalLiquidity: z.number().optional(),
});

const ManifoldResponseSchema = z.array(ManifoldMarketSchema);

/**
 * Manifold Markets Adapter - Fetches and normalizes data from Manifold
 * 
 * MANIFOLD BASICS:
 * - Free API, no authentication needed
 * - Play money (mana), not real dollars
 * - Great for testing because markets are less efficient (easier to find "arbitrage")
 * - Binary markets use probability: 0.60 = 60% chance = "Yes" costs $0.60
 */
export class ManifoldAdapter {
  private baseUrl = 'https://api.manifold.markets/v0';

  /**
   * Fetch binary markets (Yes/No only)
   * 
   * Why binary only?
   * - Multi-choice markets are complex (3+ outcomes)
   * - Arbitrage calculator currently only handles 2 outcomes
   * - Binary markets are 90% of prediction markets anyway
   * 
   * @param limit - How many markets to fetch
   */
  async fetchMarkets(limit = 20): Promise<StandardMarket[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/markets`, {
        params: {
          limit: limit * 2, // Fetch extra because we'll filter for binary
        },
        timeout: 10000,
      });

      const validatedData = ManifoldResponseSchema.parse(response.data);

      // Filter and transform
      const binaryMarkets = validatedData
        .filter(market => this.isBinaryMarket(market))
        .slice(0, limit) // Take only the limit we need
        .map(market => this.toStandardMarket(market));

      return binaryMarkets;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Manifold API Error:', error.message);
        throw new Error(`Failed to fetch Manifold data: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if a market is binary (Yes/No)
   * 
   * We skip:
   * - Resolved markets (already closed)
   * - Non-binary markets (multiple choice, free response)
   * - Markets without probability data
   */
  private isBinaryMarket(market: z.infer<typeof ManifoldMarketSchema>): boolean {
    return (
      market.outcomeType === 'BINARY' &&
      !market.isResolved &&
      market.probability !== undefined
    );
  }

  /**
   * Convert Manifold format to StandardMarket
   * 
   * KEY CONVERSION:
   * Manifold gives us ONE number (probability)
   * We create TWO outcomes:
   *   - Yes price = probability
   *   - No price = 1 - probability
   * 
   * Example:
   * Manifold: { probability: 0.65 }
   * Becomes: { Yes: $0.65, No: $0.35 }
   */
  private toStandardMarket(market: z.infer<typeof ManifoldMarketSchema>): StandardMarket {
    // Get probability (should exist due to isBinaryMarket filter)
    const probability = market.probability || 0.5;

    // Create Yes/No outcomes
    const yesPrice = new Decimal(probability);
    const noPrice = new Decimal(1 - probability);

    return {
      id: market.id,
      platform: 'MANIFOLD',
      title: market.question,
      outcomes: [
        { name: 'Yes', price: yesPrice },
        { name: 'No', price: noPrice },
      ],
      url: market.url,
      endDate: market.closeTime ? new Date(market.closeTime) : undefined,
      liquidity: market.totalLiquidity ? new Decimal(market.totalLiquidity) : undefined,
    };
  }

  /**
   * Fetch a single market by slug
   * (Useful for debugging specific markets)
   */
  async fetchMarketBySlug(slug: string): Promise<StandardMarket | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/slug/${slug}`);
      const validatedData = ManifoldMarketSchema.parse(response.data);

      if (!this.isBinaryMarket(validatedData)) {
        console.log(`Market "${slug}" is not a binary market`);
        return null;
      }

      return this.toStandardMarket(validatedData);
    } catch (error) {
      console.error(`Failed to fetch market ${slug}:`, error);
      return null;
    }
  }
}
