/**
 * Clear Redis Cache and Queue
 * 
 * Use this to reset everything when testing
 */

import { Cache, closeRedis } from '../services/redis.js';
import { clearQueue } from '../services/queue.js';
import { logger } from '../utils/logger.js';

async function clearAll() {
  console.log('🧹 CLEARING REDIS DATA');
  console.log('══════════════════════════════════════════\n');

  try {
    // Clear cache
    logger.info('Clearing cache...');
    await Cache.clear();
    logger.success('Cache cleared');

    // Clear queue
    logger.info('Clearing job queue...');
    await clearQueue();
    logger.success('Queue cleared');

    // Show stats
    const stats = await Cache.getStats();
    console.log(`\n✅ Done! Redis has ${stats.keys} keys, ${stats.memory} memory`);

    await closeRedis();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to clear:', error);
    await closeRedis();
    process.exit(1);
  }
}

clearAll();
