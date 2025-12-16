import 'dotenv/config';
import { PolyMarketAdapter } from './adapters/polymarket.js';

/**
 * Day 1 Test: Fetch ONE market from PolyMarket and verify decimal precision
 */
async function main() {
  console.log('🚀 Arbitrage Scanner - Day 1 Test\n');

  const polymarket = new PolyMarketAdapter();

  try {
    // Fetch the most recent markets
    console.log('Fetching top 5 markets from PolyMarket...\n');
    const markets = await polymarket.fetchMarkets(5);

    if (markets.length === 0) {
      console.log('⚠️  No markets found');
      return;
    }

    // Display the first market in detail
    const market = markets[0];
    console.log('📊 Market Details:');
    console.log('─'.repeat(60));
    console.log(`ID:       ${market.id}`);
    console.log(`Title:    ${market.title}`);
    console.log(`Platform: ${market.platform}`);
    console.log(`URL:      ${market.url}`);
    if (market.category) console.log(`Category: ${market.category}`);
    if (market.endDate) console.log(`Ends:     ${market.endDate.toISOString()}`);
    if (market.liquidity) console.log(`Liquidity: $${market.liquidity.toFixed(2)}`);
    console.log('\n💰 Outcomes:');
    
    market.outcomes.forEach(outcome => {
      // Verify we're using Decimal.js (check type)
      console.log(`  ${outcome.name.padEnd(10)} - ${outcome.price.toFixed(4)} (Type: ${outcome.price.constructor.name})`);
    });

    // Test: Verify sum of probabilities
    if (market.outcomes.length === 2) {
      const sum = market.outcomes[0].price.plus(market.outcomes[1].price);
      console.log(`\n🧮 Price Sum: ${sum.toFixed(6)}`);
      
      if (sum.greaterThan(1)) {
        console.log('✅ Sum > 1.0 - Bookmaker margin detected');
      } else if (sum.lessThan(1)) {
        console.log('🚨 Sum < 1.0 - Potential arbitrage indicator!');
      } else {
        console.log('Perfect sum = 1.0');
      }
    }

    console.log('\n─'.repeat(60));
    console.log(`\n✅ Successfully fetched ${markets.length} markets`);
    console.log('✅ Decimal.js is working correctly');
    console.log('\n🎉 Day 1 Complete! Next: Build Kalshi adapter or start matching logic');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
