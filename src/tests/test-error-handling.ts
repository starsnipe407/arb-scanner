/**
 * Test Error Handling & Rate Limiting
 * 
 * This demonstrates:
 * 1. Custom error types
 * 2. Rate limiting in action
 * 3. Retry logic with exponential backoff
 */

import { PolyMarketAdapter } from '../adapters/polymarket.js';
import { ManifoldAdapter } from '../adapters/manifold.js';
import { logger } from '../utils/logger.js';
import { APIError } from '../utils/errors.js';

async function testErrorHandling() {
  console.log('🧪 TESTING ERROR HANDLING & RATE LIMITING');
  console.log('══════════════════════════════════════════\n');

  // Test 1: Normal operation with rate limiting
  console.log('📝 Test 1: Normal API calls (rate limited)');
  console.log('-------------------------------------------');
  
  const polymarket = new PolyMarketAdapter();
  const manifold = new ManifoldAdapter();

  try {
    logger.info('Fetching 5 markets from each platform...');
    const startTime = Date.now();
    
    // These will be automatically rate limited
    const [polyMarkets, manifoldMarkets] = await Promise.all([
      polymarket.fetchMarkets(5),
      manifold.fetchMarkets(5),
    ]);

    const duration = Date.now() - startTime;
    
    logger.success(`✅ Fetched ${polyMarkets.length} PolyMarket + ${manifoldMarkets.length} Manifold markets`);
    logger.info(`⏱️  Total time: ${duration}ms (includes rate limiting)`);
    
  } catch (error) {
    if (error instanceof APIError) {
      logger.error(`API Error: ${error.message}`);
      logger.info(`Platform: ${error.platform}`);
      logger.info(`Retryable: ${error.isRetryable()}`);
      logger.info(`Suggested delay: ${error.getRetryDelay()}ms`);
    } else {
      logger.error(`Unexpected error: ${error}`);
    }
  }

  console.log('\n');

  // Test 2: Invalid market ID (should fail gracefully)
  console.log('📝 Test 2: Invalid market ID (should fail gracefully)');
  console.log('------------------------------------------------------');
  
  try {
    logger.info('Attempting to fetch non-existent market...');
    const market = await polymarket.fetchMarketById('invalid-market-id-12345');
    
    if (market === null) {
      logger.warn('✅ Correctly returned null for invalid market');
    } else {
      logger.error('❌ Should have returned null');
    }
  } catch (error) {
    logger.warn('Caught error (expected):');
    console.log(error);
  }

  console.log('\n');

  // Test 3: Rate limiting demonstration
  console.log('📝 Test 3: Rate limiting (multiple rapid requests)');
  console.log('---------------------------------------------------');
  
  try {
    logger.info('Making 10 rapid requests to PolyMarket...');
    logger.info('Watch for "Request queued" debug messages');
    
    const startTime = Date.now();
    
    // Make 10 rapid requests - rate limiter will queue them
    const promises = Array.from({ length: 10 }, (_, i) => 
      polymarket.fetchMarkets(2)
    );
    
    await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    
    logger.success(`✅ Completed 10 requests in ${duration}ms`);
    logger.info(`Expected: ~${10 * 100}ms minimum (10 requests × 100ms/request)`);
    
  } catch (error) {
    logger.error(`Error during rate limit test: ${error}`);
  }

  console.log('\n══════════════════════════════════════════');
  console.log('✅ All tests completed!');
}

// Run tests
testErrorHandling().catch(console.error);
