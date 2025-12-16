/**
 * Rate Limiters for API Platforms
 * 
 * Uses bottleneck to prevent exceeding API rate limits
 */

import Bottleneck from 'bottleneck';
import { logger } from './logger';

/**
 * PolyMarket rate limiter
 * Conservative limit: 10 requests per second
 */
export const polyMarketLimiter = new Bottleneck({
  maxConcurrent: 5, // Max 5 concurrent requests
  minTime: 100,     // Min 100ms between requests (10 req/sec)
  reservoir: 50,    // Start with 50 tokens
  reservoirRefreshAmount: 50, // Refill 50 tokens
  reservoirRefreshInterval: 5000, // Every 5 seconds
});

/**
 * Manifold rate limiter
 * More conservative: 5 requests per second (play money, be nice)
 */
export const manifoldLimiter = new Bottleneck({
  maxConcurrent: 3, // Max 3 concurrent requests
  minTime: 200,     // Min 200ms between requests (5 req/sec)
  reservoir: 25,    // Start with 25 tokens
  reservoirRefreshAmount: 25, // Refill 25 tokens
  reservoirRefreshInterval: 5000, // Every 5 seconds
});

/**
 * Kalshi rate limiter (for future use)
 * Very conservative: 2 requests per second (real money, be careful)
 */
export const kalshiLimiter = new Bottleneck({
  maxConcurrent: 2, // Max 2 concurrent requests
  minTime: 500,     // Min 500ms between requests (2 req/sec)
  reservoir: 10,    // Start with 10 tokens
  reservoirRefreshAmount: 10, // Refill 10 tokens
  reservoirRefreshInterval: 5000, // Every 5 seconds
});

// Log rate limit events
polyMarketLimiter.on('depleted', () => {
  logger.warn('PolyMarket rate limit depleted, waiting for refill...');
});

manifoldLimiter.on('depleted', () => {
  logger.warn('Manifold rate limit depleted, waiting for refill...');
});

kalshiLimiter.on('depleted', () => {
  logger.warn('Kalshi rate limit depleted, waiting for refill...');
});

// Log when jobs are queued due to rate limits
polyMarketLimiter.on('queued', () => {
  logger.debug('Request queued - PolyMarket rate limit active');
});

manifoldLimiter.on('queued', () => {
  logger.debug('Request queued - Manifold rate limit active');
});

kalshiLimiter.on('queued', () => {
  logger.debug('Request queued - Kalshi rate limit active');
});
