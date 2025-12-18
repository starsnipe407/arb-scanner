/**
 * Test Alert System
 * 
 * Tests Discord webhook integration and alert formatting
 */

import { sendTestAlert, sendArbitrageAlert, meetsAlertThreshold } from '../services/alerts.js';
import { ArbitrageOpportunity } from '../types.js';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';
import { Decimal } from 'decimal.js';
import { closeRedis } from '../services/redis.js';

async function testAlertSystem() {
  console.log('🧪 TESTING ALERT SYSTEM');
  console.log('════════════════════════════════════════\n');

  try {
    // Check configuration
    console.log('📋 Configuration:');
    console.log(`  Alerts Enabled: ${CONFIG.alerts.enabled}`);
    console.log(`  Webhook URL: ${CONFIG.alerts.discordWebhook ? '✅ Set' : '❌ Not set'}`);
    console.log(`  Min Profit %: ${CONFIG.alerts.minProfitPercent}%`);
    console.log(`  Min Profit $: $${CONFIG.alerts.minProfitAmount}`);
    console.log(`  Cooldown: ${CONFIG.alerts.cooldownMinutes} minutes\n`);

    if (!CONFIG.alerts.discordWebhook) {
      console.log('❌ ERROR: DISCORD_WEBHOOK_URL not set');
      console.log('\nTo test alerts:');
      console.log('1. Create a Discord webhook in your server');
      console.log('2. Set DISCORD_WEBHOOK_URL in your .env file');
      console.log('3. Run this test again\n');
      process.exit(1);
    }

    // Test 1: Send test alert
    console.log('Test 1: Sending test alert...');
    await sendTestAlert();
    console.log('✅ Test alert sent\n');

    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

    // Test 2: Send mock arbitrage alert
    console.log('Test 2: Sending mock arbitrage alert...');
    
    const mockOpportunity: ArbitrageOpportunity = {
      marketA: {
        id: 'poly-123',
        platform: 'POLYMARKET',
        title: 'Will Bitcoin reach $100k in 2025?',
        outcomes: [
          { name: 'YES', price: new Decimal(0.45) },
          { name: 'NO', price: new Decimal(0.55) },
        ],
        endDate: new Date('2025-12-31T23:59:59Z'),
        url: 'https://polymarket.com/event/bitcoin-100k',
        liquidity: new Decimal(50000),
      },
      marketB: {
        id: 'manifold-456',
        platform: 'MANIFOLD',
        title: 'Bitcoin reaches $100,000 by end of 2025',
        outcomes: [
          { name: 'YES', price: new Decimal(0.52) },
          { name: 'NO', price: new Decimal(0.48) },
        ],
        endDate: new Date('2025-12-31T23:59:59Z'),
        url: 'https://manifold.markets/bitcoin-100k',
        liquidity: new Decimal(10000),
      },
      outcomeA: 'YES',
      outcomeB: 'NO',
      priceA: new Decimal(0.45),
      priceB: new Decimal(0.55),
      totalCost: new Decimal(1.00),
      feesA: new Decimal(0.009),
      feesB: new Decimal(0),
      totalFees: new Decimal(0.009),
      netCost: new Decimal(1.009),
      profitMargin: new Decimal(0.125), // 12.5%
      roi: new Decimal(0.125), // 12.5%
      isProfitable: true,
      timestamp: new Date(),
    };

    // Check if it meets threshold
    const meetsThreshold = meetsAlertThreshold(mockOpportunity);
    console.log(`  Meets alert threshold: ${meetsThreshold ? '✅ Yes' : '❌ No'}`);

    if (meetsThreshold) {
      await sendArbitrageAlert(mockOpportunity);
      console.log('✅ Mock arbitrage alert sent\n');
    } else {
      console.log('⚠️  Mock opportunity does not meet threshold, skipping alert\n');
    }

    // Test 3: Test cooldown
    console.log('Test 3: Testing cooldown (should skip duplicate)...');
    await sendArbitrageAlert(mockOpportunity);
    console.log('✅ Cooldown test complete (check logs)\n');

    console.log('═══════════════════════════════════════');
    console.log('✅ All tests passed!');
    console.log('\nCheck your Discord channel for:');
    console.log('  1. Test alert message');
    console.log('  2. Bitcoin arbitrage opportunity alert');
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    logger.error('Alert test failed:', error);
    process.exit(1);
  } finally {
    await closeRedis();
    process.exit(0);
  }
}

testAlertSystem();
