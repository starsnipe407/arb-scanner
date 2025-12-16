import axios from 'axios';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { StandardMarket } from '../types.js';
import { manifoldLimiter } from '../utils/rateLimiter.js';
import { APIError, ValidationError, classifyError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { retryWithBackoff } from '../utils/helpers.js';

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
   * Uses rate limiting and automatic retries with exponential backoff
   * 
   * Why binary only?
   * - Multi-choice markets are complex (3+ outcomes)
   * - Arbitrage calculator currently only handles 2 outcomes
   * - Binary markets are 90% of prediction markets anyway
   * 
   * @param limit - How many markets to fetch
   */
  async fetchMarkets(limit = 20): Promise<StandardMarket[]> {
    const operation = async () => {
      return await manifoldLimiter.schedule(async () => {
        try {
          logger.debug(`Fetching ${limit} markets from Manifold...`);
          
          const response = await axios.get(`${this.baseUrl}/markets`, {
            params: {
              limit: limit * 2, // Fetch extra because we'll filter for binary
            },
            timeout: 10000,
          });

          // Validate response
          let validatedData;
          try {
            validatedData = ManifoldResponseSchema.parse(response.data);
          } catch (zodError) {
            throw new ValidationError(
              'Invalid response format from Manifold',
              response.data,
              zodError
            );
          }

          // Filter and transform
          const binaryMarkets = validatedData
            .filter(market => this.isBinaryMarket(market))
            .slice(0, limit)
            .map(market => this.toStandardMarket(market));

          logger.success(`Fetched ${binaryMarkets.length} binary markets from Manifold`);
          return binaryMarkets;
        } catch (error) {
          const classifiedError = classifyError(error, 'Manifold');
          logger.error(`Manifold API error: ${classifiedError.message}`);
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
        if (error instanceof APIError) {
          return error.isRetryable();
        }
        return false;
      },
    });
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
   * Uses rate limiting and error handling
   * (Useful for debugging specific markets)
   */
  async fetchMarketBySlug(slug: string): Promise<StandardMarket | null> {
    try {
      const market = await manifoldLimiter.schedule(async () => {
        logger.debug(`Fetching market ${slug} from Manifold...`);
        
        const response = await axios.get(`${this.baseUrl}/slug/${slug}`, {
          timeout: 10000,
        });

        let validatedData;
        try {
          validatedData = ManifoldMarketSchema.parse(response.data);
        } catch (zodError) {
          throw new ValidationError(
            `Invalid market data for ${slug}`,
            response.data,
            zodError
          );
        }

        if (!this.isBinaryMarket(validatedData)) {
          logger.warn(`Market "${slug}" is not a binary market`);
          return null;
        }

        return this.toStandardMarket(validatedData);
      });

      if (market) {
        logger.success(`Fetched market ${slug} from Manifold`);
      }
      return market;
    } catch (error) {
      const classifiedError = classifyError(error, 'Manifold');
      logger.error(`Failed to fetch market ${slug}: ${classifiedError.message}`);
      return null;
    }
  }
}
