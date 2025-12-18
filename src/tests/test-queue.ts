/**
 * Test Queue System
 * 
 * Tests the job queue and caching without starting the full scheduler
 */

import { addScanJob, getQueueStats, clearQueue, createScanWorker } from '../services/queue.js';
import { Cache, CacheKeys, closeRedis } from '../services/redis.js';
import { logger } from '../utils/logger.js';

async function testQueue() {
  console.log('🧪 TESTING JOB QUEUE SYSTEM');
  console.log('══════════════════════════════════════════\n');

  try {
    // Test 1: Cache operations
    console.log('📝 Test 1: Cache Operations');
    console.log('─────────────────────────────────────────');
    
    await Cache.set('test-key', { hello: 'world' }, 60);
    const cached = await Cache.get('test-key');
    console.log('✅ Set and get:', cached);
    
    const exists = await Cache.exists('test-key');
    console.log('✅ Exists check:', exists);
    
    await Cache.delete('test-key');
    const afterDelete = await Cache.get('test-key');
    console.log('✅ After delete:', afterDelete);
    
    console.log('\n');

    // Test 2: Queue stats
    console.log('📝 Test 2: Queue Stats (before jobs)');
    console.log('─────────────────────────────────────────');
    
    const statsBefore = await getQueueStats();
    console.log('Stats:', statsBefore);
    
    console.log('\n');

    // Test 3: Add a job
    console.log('📝 Test 3: Add Single Scan Job');
    console.log('─────────────────────────────────────────');
    
    const job = await addScanJob({
      platformA: 'POLYMARKET',
      platformB: 'MANIFOLD',
      limit: 10, // Small test
    });
    
    console.log(`✅ Job added: ${job.id}`);
    console.log(`   Platform A: ${job.data.platformA}`);
    console.log(`   Platform B: ${job.data.platformB}`);
    console.log(`   Limit: ${job.data.limit}`);
    
    console.log('\n');

    // Test 4: Start worker and process job
    console.log('📝 Test 4: Process Job with Worker');
    console.log('─────────────────────────────────────────');
    console.log('Starting worker...');
    
    const worker = createScanWorker();
    
    // Wait for job to complete (max 30 seconds)
    console.log('Waiting for job to complete...\n');
    
    await new Promise((resolve) => {
      worker.on('completed', async (completedJob, result) => {
        console.log('✅ Job completed!');
        console.log(`   Job ID: ${completedJob.id}`);
        console.log(`   Duration: ${result.duration}ms`);
        console.log(`   Markets scanned: ${JSON.stringify(result.marketsScanned)}`);
        console.log(`   Matches found: ${result.matchesFound}`);
        console.log(`   Opportunities: ${result.opportunities.length}`);
        
        // Show opportunities
        if (result.opportunities.length > 0) {
          console.log('\n💰 Arbitrage Opportunities:');
          result.opportunities.forEach((opp, i) => {
            console.log(`   ${i + 1}. ${opp.marketA.title.substring(0, 50)}...`);
            console.log(`      ROI: ${opp.roi.toFixed(2)}%`);
            console.log(`      Profit Margin: $${opp.profitMargin.toFixed(4)}`);
          });
        }
        
        resolve(null);
      });

      worker.on('failed', (failedJob, error) => {
        console.log('❌ Job failed:', error.message);
        resolve(null);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        console.log('⏱️  Timeout - job took too long');
        resolve(null);
      }, 30000);
    });

    console.log('\n');

    // Test 5: Check cached results
    console.log('📝 Test 5: Check Cached Results');
    console.log('─────────────────────────────────────────');
    
    const cachedOpportunities = await Cache.get(CacheKeys.opportunities());
    console.log(`✅ Cached opportunities: ${cachedOpportunities ? 'Found' : 'Not found'}`);
    
    const cacheStats = await Cache.getStats();
    console.log(`✅ Cache stats: ${cacheStats.keys} keys, ${cacheStats.memory} memory`);
    
    console.log('\n');

    // Test 6: Queue stats after job
    console.log('📝 Test 6: Queue Stats (after job)');
    console.log('─────────────────────────────────────────');
    
    const statsAfter = await getQueueStats();
    console.log('Stats:', statsAfter);
    
    console.log('\n');

    // Cleanup
    console.log('🧹 Cleaning up...');
    await worker.close();
    await closeRedis();
    
    console.log('══════════════════════════════════════════');
    console.log('✅ All tests completed!\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await closeRedis();
    process.exit(1);
  }
}

// Run tests
testQueue();
