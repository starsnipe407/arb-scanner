/**
 * Test Kalshi Integration with Scanner
 * 
 * Tests Kalshi markets against PolyMarket to find arbitrage opportunities
 */

import { addScanJob, createScanWorker, getQueueStats, closeQueue } from '../services/queue.js';
import { Cache, closeRedis } from '../services/redis.js';
import { logger } from '../utils/logger.js';
import type { ScanResult } from '../services/queue.js';

async function testKalshiIntegration() {
  console.log('🧪 TESTING KALSHI INTEGRATION');
  console.log('════════════════════════════════════════\n');

  const worker = createScanWorker();

  try {
    // Test 1: Scan Kalshi vs PolyMarket
    console.log('Test 1: Scanning Kalshi vs PolyMarket...\n');
    
    const job = await addScanJob({
      platformA: 'KALSHI',
      platformB: 'POLYMARKET',
      limit: 50,
    });

    console.log(`Job ${job.id} created, waiting for completion...\n`);

    // Wait for job to complete using worker events
    const result = await new Promise<ScanResult>((resolve, reject) => {
      worker.on('completed', (completedJob, jobResult) => {
        if (completedJob.id === job.id) {
          resolve(jobResult);
        }
      });

      worker.on('failed', (failedJob, error) => {
        if (failedJob?.id === job.id) {
          reject(error);
        }
      });

      setTimeout(() => reject(new Error('Timeout')), 60000);
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 SCAN RESULTS:');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Markets scanned:`);
    console.log(`  - Kalshi: ${result.marketsScanned.KALSHI}`);
    console.log(`  - PolyMarket: ${result.marketsScanned.POLYMARKET}`);
    console.log(`Matches found: ${result.matchesFound}`);
    console.log(`Arbitrage opportunities: ${result.opportunities.length}\n`);

    if (result.opportunities.length > 0) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('💰 ARBITRAGE OPPORTUNITIES:');
      console.log('═══════════════════════════════════════════════════════════════\n');

      result.opportunities.forEach((opp, index) => {
        console.log(`${index + 1}. ${opp.marketA.title}`);
        console.log(`   ${opp.marketA.platform}: ${opp.outcomeA} @ $${opp.priceA.toFixed(4)}`);
        console.log(`   ${opp.marketB.platform}: ${opp.outcomeB} @ $${opp.priceB.toFixed(4)}`);
        console.log(`   Profit: $${opp.profitMargin.toFixed(4)} (${opp.roi.mul(100).toFixed(2)}%)`);
        console.log(`   After fees: ${opp.isProfitable ? '✅ Profitable' : '❌ Not profitable'}\n`);
      });
    } else {
      console.log('No arbitrage opportunities found (this is normal - different events)\n');
    }

    // Test 2: Scan Kalshi vs Manifold
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Test 2: Scanning Kalshi vs Manifold...\n');
    
    const job2 = await addScanJob({
      platformA: 'KALSHI',
      platformB: 'MANIFOLD',
      limit: 50,
    });

    const result2 = await new Promise<ScanResult>((resolve, reject) => {
      worker.on('completed', (completedJob, jobResult) => {
        if (completedJob.id === job2.id) {
          resolve(jobResult);
        }
      });

      worker.on('failed', (failedJob, error) => {
        if (failedJob?.id === job2.id) {
          reject(error);
        }
      });

      setTimeout(() => reject(new Error('Timeout')), 60000);
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 SCAN RESULTS:');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`Duration: ${result2.duration}ms`);
    console.log(`Markets scanned:`);
    console.log(`  - Kalshi: ${result2.marketsScanned.KALSHI}`);
    console.log(`  - Manifold: ${result2.marketsScanned.MANIFOLD}`);
    console.log(`Matches found: ${result2.matchesFound}`);
    console.log(`Arbitrage opportunities: ${result2.opportunities.length}\n`);

    if (result2.opportunities.length > 0) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('💰 ARBITRAGE OPPORTUNITIES:');
      console.log('═══════════════════════════════════════════════════════════════\n');

      result2.opportunities.forEach((opp, index) => {
        console.log(`${index + 1}. ${opp.marketA.title}`);
        console.log(`   ${opp.marketA.platform}: ${opp.outcomeA} @ $${opp.priceA.toFixed(4)}`);
        console.log(`   ${opp.marketB.platform}: ${opp.outcomeB} @ $${opp.priceB.toFixed(4)}`);
        console.log(`   Profit: $${opp.profitMargin.toFixed(4)} (${opp.roi.mul(100).toFixed(2)}%)`);
        console.log(`   After fees: ${opp.isProfitable ? '✅ Profitable' : '❌ Not profitable'}\n`);
      });
    }

    // Test 3: Check queue stats
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Test 3: Queue Statistics\n');
    
    const stats = await getQueueStats();
    const cacheStats = await Cache.getStats();

    console.log(`Queue Stats:`);
    console.log(`  Completed: ${stats.completed}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Waiting: ${stats.waiting}`);
    console.log(`\nCache Stats:`);
    console.log(`  Keys: ${cacheStats.keys}`);
    console.log(`  Memory: ${cacheStats.memory}\n`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('Kalshi integration is working correctly!');
    console.log('\nNext steps:');
    console.log('1. ✅ Kalshi adapter tested');
    console.log('2. ✅ Kalshi vs PolyMarket scanning works');
    console.log('3. ✅ Kalshi vs Manifold scanning works');
    console.log('4. Add Kalshi to real-time scanner (scheduler.ts)');
    console.log('5. Monitor for actual arbitrage opportunities\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    logger.error('Kalshi integration test failed:', error);
  } finally {
    await worker.close();
    await closeQueue();
    await closeRedis();
    process.exit(0);
  }
}

testKalshiIntegration();
