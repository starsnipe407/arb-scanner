/**
 * Real-Time Scanner Scheduler
 * 
 * Starts background workers and recurring scan jobs
 * Runs continuously, scanning every 60 seconds
 */

import { createScanWorker, addRecurringScanJob, getQueueStats } from './services/queue.js';
import { Cache, closeRedis } from './services/redis.js';
import { logger } from './utils/logger.js';

/**
 * Start the real-time scanner
 */
async function startScheduler() {
  console.log('🔄 REAL-TIME ARBITRAGE SCANNER');
  console.log('══════════════════════════════════════════\n');

  try {
    // Step 1: Start the worker
    logger.info('Starting background worker...');
    const worker = createScanWorker();
    logger.success('Worker started and ready to process jobs');

    // Step 2: Add recurring scan jobs
    logger.info('Setting up recurring scans...');
    
    // Scan PolyMarket vs Manifold every 60 seconds
    await addRecurringScanJob({
      platformA: 'POLYMARKET',
      platformB: 'MANIFOLD',
      limit: 200,
    }, 60);

    // Scan Kalshi vs PolyMarket every 60 seconds
    await addRecurringScanJob({
      platformA: 'KALSHI',
      platformB: 'POLYMARKET',
      limit: 100,
    }, 60);

    // Scan Kalshi vs Manifold every 60 seconds
    await addRecurringScanJob({
      platformA: 'KALSHI',
      platformB: 'MANIFOLD',
      limit: 100,
    }, 60);

    logger.success('Recurring scans configured');

    // Step 3: Display status
    console.log('\n✅ Scanner is now running!');
    console.log('───────────────────────────');
    console.log('📊 Scan Frequency: Every 60 seconds');
    console.log('🔍 Scanning Pairs:');
    console.log('   • PolyMarket (200) vs Manifold (200)');
    console.log('   • Kalshi (100) vs PolyMarket (100)');
    console.log('   • Kalshi (100) vs Manifold (100)');
    console.log('💾 Caching: Enabled (2 min TTL)');
    console.log('📈 Results: Stored for 1 hour');
    console.log('🚨 Alerts: Discord notifications enabled\n');

    // Step 4: Monitor queue stats every 30 seconds
    setInterval(async () => {
      const stats = await getQueueStats();
      const cacheStats = await Cache.getStats();
      
      console.log('\n📊 SCANNER STATUS');
      console.log('─────────────────────────────────────────');
      console.log(`⏳ Jobs in queue: ${stats.waiting}`);
      console.log(`⚡ Jobs active: ${stats.active}`);
      console.log(`✅ Jobs completed: ${stats.completed}`);
      console.log(`❌ Jobs failed: ${stats.failed}`);
      console.log(`💾 Cached keys: ${cacheStats.keys}`);
      console.log(`🧠 Memory used: ${cacheStats.memory}`);
      console.log(`🕐 ${new Date().toLocaleTimeString()}\n`);
    }, 30000);

    // Step 5: Handle shutdown gracefully
    const shutdown = async () => {
      console.log('\n\n🛑 Shutting down scanner...');
      logger.info('Closing worker...');
      await worker.close();
      logger.info('Closing Redis...');
      await closeRedis();
      logger.success('Scanner stopped gracefully');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Keep process alive
    logger.info('Scanner running. Press Ctrl+C to stop.');
    
  } catch (error) {
    logger.error('Failed to start scheduler:', error);
    process.exit(1);
  }
}

// Start the scheduler
startScheduler();
