import axios from 'axios';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { StandardMarket } from '../types.js';
import { kalshiLimiter } from '../utils/rateLimiter.js';
import { APIError, ValidationError, classifyError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { retryWithBackoff } from '../utils/helpers.js';

/**
 * Zod schema for Kalshi API response validation
 * Protects against API changes
 * 
 * Note: Kalshi returns prices in cents (9 = $0.09)
 */
const KalshiMarketSchema = z.object({
  ticker: z.string(),
  event_ticker: z.string(),
  market_type: z.enum(['binary', 'scalar']),
  title: z.string(),
  subtitle: z.string().optional(),
  yes_sub_title: z.string().optional(),
  no_sub_title: z.string().optional(),
  status: z.string(), // Changed from enum to string - API returns 'active' not 'open'
  close_time: z.string(),
  yes_ask: z.number().optional(),
  no_ask: z.number().optional(),
  yes_bid: z.number().optional(),
  no_bid: z.number().optional(),
  last_price: z.number().optional(),
  volume: z.number().optional(),
  volume_24h: z.number().optional(),
  liquidity: z.number().optional(),
  open_interest: z.number().optional(),
  category: z.string().optional(),
});

const KalshiResponseSchema = z.object({
  markets: z.array(KalshiMarketSchema),
  cursor: z.string().optional(),
});

type KalshiMarket = z.infer<typeof KalshiMarketSchema>;

/**
 * Kalshi Adapter - Fetches and normalizes data from Kalshi API
 * 
 * API Docs: https://docs.kalshi.com/api-reference/market/get-markets
 */
export class KalshiAdapter {
  private baseUrl = 'https://api.elections.kalshi.com/trade-api/v2';

  /**
   * Fetch active markets from Kalshi
   * Uses rate limiting and automatic retries with exponential backoff
   */
  async fetchMarkets(limit = 100): Promise<StandardMarket[]> {
    const operation = async () => {
      // Wrap API call with rate limiter
      return await kalshiLimiter.schedule(async () => {
        try {
          logger.debug(`Fetching ${limit} markets from Kalshi...`);
          
          const response = await axios.get(`${this.baseUrl}/markets`, {
            params: {
              limit,
              status: 'open', // Kalshi uses 'open' not 'active' in the API
            },
            headers: {
              'Accept': 'application/json',
            },
            timeout: 10000, // 10 second timeout
          });

          // Validate response with Zod
          let validatedData;
          try {
            validatedData = KalshiResponseSchema.parse(response.data);
          } catch (zodError) {
            throw new ValidationError(
              'Invalid response format from Kalshi',
              response.data,
              zodError
            );
          }

          // Filter to binary markets only (skip scalar markets for now)
          const binaryMarkets = validatedData.markets.filter(
            market => market.market_type === 'binary' && market.yes_ask !== undefined
          );

          // Transform to StandardMarket format
          const markets = binaryMarkets.map(market => this.toStandardMarket(market));
          logger.success(`Fetched ${markets.length} binary markets from Kalshi`);
          
          return markets;
        } catch (error) {
          // Classify error type
          const classifiedError = classifyError(error, 'Kalshi');
          logger.error(`Kalshi API error: ${classifiedError.message}`);
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
   * Fetch a single market by ticker (useful for testing)
   */
  async fetchMarketByTicker(ticker: string): Promise<StandardMarket | null> {
    try {
      const market = await kalshiLimiter.schedule(async () => {
        logger.debug(`Fetching market ${ticker} from Kalshi...`);
        
        const response = await axios.get(`${this.baseUrl}/markets/${ticker}`, {
          headers: {
            'Accept': 'application/json',
          },
          timeout: 10000,
        });

        let validatedData;
        try {
          validatedData = KalshiMarketSchema.parse(response.data.market);
        } catch (zodError) {
          throw new ValidationError(
            `Invalid market data for ${ticker}`,
            response.data,
            zodError
          );
        }

        return this.toStandardMarket(validatedData);
      });

      logger.success(`Fetched market ${ticker} from Kalshi`);
      return market;
    } catch (error) {
      const classifiedError = classifyError(error, 'Kalshi');
      
      if (classifiedError instanceof APIError && classifiedError.statusCode === 404) {
        logger.warn(`Market ${ticker} not found on Kalshi`);
        return null;
      }

      logger.error(`Kalshi API error: ${classifiedError.message}`);
      throw classifiedError;
    }
  }

  /**
   * Transform Kalshi market to StandardMarket format
   */
  private toStandardMarket(market: KalshiMarket): StandardMarket {
    // Kalshi prices are in cents, convert to dollars
    const yesPrice = market.yes_ask ? market.yes_ask / 100 : 0;
    const noPrice = market.no_ask ? market.no_ask / 100 : 0;

    // Build URL to market
    const url = `https://kalshi.com/markets/${market.ticker}`;

    // Parse close time
    const endDate = market.close_time ? new Date(market.close_time) : undefined;

    // Convert liquidity from cents to dollars
    const liquidity = market.liquidity ? new Decimal(market.liquidity).div(100) : undefined;

    return {
      id: market.ticker,
      platform: 'KALSHI',
      title: market.title,
      outcomes: [
        {
          name: 'YES',
          price: new Decimal(yesPrice),
        },
        {
          name: 'NO',
          price: new Decimal(noPrice),
        },
      ],
      url,
      category: market.category || undefined,
      endDate,
      liquidity,
    };
  }
}
