import axios from 'axios';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { StandardMarket } from '../types.js';
import { polyMarketLimiter } from '../utils/rateLimiter.js';
import { APIError, ValidationError, classifyError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { retryWithBackoff } from '../utils/helpers.js';

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
   * Uses rate limiting and automatic retries with exponential backoff
   */
  async fetchMarkets(limit = 20): Promise<StandardMarket[]> {
    const operation = async () => {
      // Wrap API call with rate limiter
      return await polyMarketLimiter.schedule(async () => {
        try {
          logger.debug(`Fetching ${limit} markets from PolyMarket...`);
          
          const response = await axios.get(`${this.baseUrl}/markets`, {
            params: {
              limit,
              active: true, // Only active markets
              closed: false,
            },
            timeout: 10000, // 10 second timeout
          });

          // Validate response with Zod
          let validatedData;
          try {
            validatedData = PolyMarketResponseSchema.parse(response.data);
          } catch (zodError) {
            throw new ValidationError(
              'Invalid response format from PolyMarket',
              response.data,
              zodError
            );
          }

          // Transform to StandardMarket format
          const markets = validatedData.map(market => this.toStandardMarket(market));
          logger.success(`Fetched ${markets.length} markets from PolyMarket`);
          
          return markets;
        } catch (error) {
          // Classify error type
          const classifiedError = classifyError(error, 'PolyMarket');
          logger.error(`PolyMarket API error: ${classifiedError.message}`);
          throw classifiedError;
        }
      });
    };

    // Retry with exponential backoff for retryable errors
    return retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      shouldRetry: (error) => {
        // Only retry APIErrors that are retryable
        if (error instanceof APIError) {
          return error.isRetryable();
        }
        return false;
        }
    });
}

  /**
   * Fetch a single market by ID (useful for testing)
   * Uses rate limiting and error handling
   */
  async fetchMarketById(marketId: string): Promise<StandardMarket | null> {
    try {
      const market = await polyMarketLimiter.schedule(async () => {
        logger.debug(`Fetching market ${marketId} from PolyMarket...`);
        
        const response = await axios.get(`${this.baseUrl}/markets/${marketId}`, {
          timeout: 10000,
        });

        let validatedData;
        try {
          validatedData = PolyMarketEventSchema.parse(response.data);
        } catch (zodError) {
          throw new ValidationError(
            `Invalid market data for ${marketId}`,
            response.data,
            zodError
          );
        }

        return this.toStandardMarket(validatedData);
      });

      logger.success(`Fetched market ${marketId} from PolyMarket`);
      return market;
    } catch (error) {
      const classifiedError = classifyError(error, 'PolyMarket');
      logger.error(`Failed to fetch market ${marketId}: ${classifiedError.message}`);
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
