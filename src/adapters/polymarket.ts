import axios from 'axios';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { StandardMarket } from '../types.js';

/**
 * Zod schema for PolyMarket API response validation
 * This protects us from API changes breaking the app
 * 
 * Note: PolyMarket returns outcomes and prices as JSON strings, not arrays
 */
const PolyMarketEventSchema = z.object({
  id: z.string(),
  question: z.string(),
  endDateIso: z.string().optional(),
  groupItemTitle: z.string().optional(),
  outcomes: z.string(), // JSON string like '["Yes", "No"]'
  outcomePrices: z.string(), // JSON string like '["0.52", "0.48"]'
  volume: z.string().optional(), // Total volume in USD
  liquidity: z.string().optional(),
});

const PolyMarketResponseSchema = z.array(PolyMarketEventSchema);

/**
 * PolyMarket Adapter - Fetches and normalizes data from PolyMarket Gamma API
 */
export class PolyMarketAdapter {
  private baseUrl = 'https://gamma-api.polymarket.com';

  /**
   * Fetch all active markets (limit to recent/popular ones for now)
   */
  async fetchMarkets(limit = 20): Promise<StandardMarket[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/markets`, {
        params: {
          limit,
          active: true, // Only active markets
          closed: false,
        },
        timeout: 10000, // 10 second timeout
      });

      // Validate response with Zod
      const validatedData = PolyMarketResponseSchema.parse(response.data);

      // Transform to StandardMarket format
      return validatedData.map(market => this.toStandardMarket(market));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('PolyMarket API Error:', error.message);
        throw new Error(`Failed to fetch PolyMarket data: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetch a single market by ID (useful for testing)
   */
  async fetchMarketById(marketId: string): Promise<StandardMarket | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/markets/${marketId}`);
      const validatedData = PolyMarketEventSchema.parse(response.data);
      return this.toStandardMarket(validatedData);
    } catch (error) {
      console.error(`Failed to fetch market ${marketId}:`, error);
      return null;
    }
  }

  /**
   * Convert PolyMarket format to StandardMarket
   */
  private toStandardMarket(market: z.infer<typeof PolyMarketEventSchema>): StandardMarket {
    // Parse JSON strings to arrays
    const outcomes: string[] = JSON.parse(market.outcomes);
    const prices: string[] = JSON.parse(market.outcomePrices);

    return {
      id: market.id,
      platform: 'POLYMARKET',
      title: market.question,
      outcomes: outcomes.map((name, index) => ({
        name,
        price: new Decimal(prices[index]),
      })),
      url: `https://polymarket.com/event/${market.id}`,
      category: market.groupItemTitle || undefined,
      endDate: market.endDateIso ? new Date(market.endDateIso) : undefined,
      liquidity: market.liquidity ? new Decimal(market.liquidity) : undefined,
    };
  }
}
