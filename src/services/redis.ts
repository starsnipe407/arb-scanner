/**
 * Redis Connection & Utilities
 * 
 * Provides Redis client for caching and message queues
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

/**
 * Redis configuration
 * 
 * For local development:
 * - Install Redis: https://redis.io/download
 * - Or use Docker: docker run -d -p 6379:6379 redis
 * 
 * For production:
 * - Use Redis Cloud, AWS ElastiCache, or similar
 */
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // BullMQ requires this to be null
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

/**
 * Create Redis client
 */
export const redis = new Redis(REDIS_CONFIG);

/**
 * Handle Redis connection events
 */
redis.on('connect', () => {
  logger.success('Connected to Redis');
});

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

/**
 * Cache utilities
 */
export class Cache {
  /**
   * Set a value with TTL (time to live)
   * 
   * @param key - Cache key
   * @param value - Value to cache (will be JSON stringified)
   * @param ttlSeconds - Time to live in seconds (default: 5 minutes)
   */
  static async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttlSeconds, serialized);
      logger.debug(`Cached: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      logger.error(`Cache set failed for ${key}:`, error);
    }
  }

  /**
   * Get a cached value
   * 
   * @param key - Cache key
   * @returns Parsed value or null if not found/expired
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      if (!cached) {
        logger.debug(`Cache miss: ${key}`);
        return null;
      }
      
      logger.debug(`Cache hit: ${key}`);
      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error(`Cache get failed for ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a cached value
   */
  static async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
      logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      logger.error(`Cache delete failed for ${key}:`, error);
    }
  }

  /**
   * Check if key exists
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists check failed for ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache (use carefully!)
   */
  static async clear(): Promise<void> {
    try {
      await redis.flushdb();
      logger.warn('Cache cleared');
    } catch (error) {
      logger.error('Cache clear failed:', error);
    }
  }

  /**
   * Get cache stats
   */
  static async getStats(): Promise<{ keys: number; memory: string }> {
    try {
      const dbSize = await redis.dbsize();
      const info = await redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memory = memoryMatch ? memoryMatch[1].trim() : 'unknown';
      
      return { keys: dbSize, memory };
    } catch (error) {
      logger.error('Cache stats failed:', error);
      return { keys: 0, memory: 'unknown' };
    }
  }
}

/**
 * Cache key generators
 */
export const CacheKeys = {
  markets: (platform: string) => `markets:${platform}`,
  matches: (platformA: string, platformB: string) => `matches:${platformA}:${platformB}`,
  opportunities: () => `opportunities:latest`,
  scanStatus: () => `scan:status`,
  scanResults: (timestamp: number) => `scan:results:${timestamp}`,
  alertSent: (marketAId: string, marketBId: string) => `alert:sent:${marketAId}:${marketBId}`,
};

/**
 * Gracefully close Redis connection
 */
export async function closeRedis(): Promise<void> {
  await redis.quit();
  logger.info('Redis connection closed');
}
