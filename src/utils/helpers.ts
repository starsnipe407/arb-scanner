/**
 * Utility Functions
 * 
 * Helper functions used across the application
 */

import { StandardMarket } from '../types.js';

/**
 * Validate that a market has required data
 */
export function isValidMarket(market: StandardMarket): boolean {
  return (
    market.id.length > 0 &&
    market.title.length > 0 &&
    market.outcomes.length >= 2 &&
    market.outcomes.every(o => o.price.greaterThanOrEqualTo(0) && o.price.lessThanOrEqualTo(1))
  );
}

/**
 * Calculate days difference between two dates
 */
export function daysDifference(date1: Date, date2: Date): number {
  return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Sanitize market title for comparison
 * Remove special characters, extra spaces, etc.
 */
export function sanitizeTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, ' ') // Multiple spaces → single space
    .replace(/[^\w\s?!$%]/g, '') // Keep only alphanumeric, spaces, and common punctuation
    .toLowerCase();
}

/**
 * Format percentage with fixed decimals
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format currency
 */
export function formatCurrency(value: number, currency: string = '$'): string {
  return `${currency}${value.toFixed(2)}`;
}

/**
 * Sleep utility for rate limiting
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a promise-based function with exponential backoff
 */
/**
 * Retry options
 */
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
  } = options;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      // If this is the last retry, throw the error
      if (i === maxRetries - 1) throw error;
      
      // Check if we should retry this error
      if (!shouldRetry(error)) throw error;
      
      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, i), maxDelay);
      await sleep(delay);
    }
  }
  throw new Error('Retry failed');
}
