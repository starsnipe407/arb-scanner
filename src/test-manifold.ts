import 'dotenv/config';
import { ManifoldAdapter } from './adapters/manifold.js';

/**
 * Test the Manifold adapter - similar to our Day 1 PolyMarket test
 */
async function main() {
  console.log('🧪 Testing Manifold Markets Adapter\n');
  console.log('═'.repeat(70));

  const manifold = new ManifoldAdapter();

  try {
    console.log('\n📥 Fetching top 5 binary markets from Manifold...\n');
    const markets = await manifold.fetchMarkets(5);

    if (markets.length === 0) {
      console.log('⚠️  No binary markets found');
      return;
    }

    // Display first market in detail
    const market = markets[0];
    console.log('📊 Market Details:');
    console.log('─'.repeat(70));
    console.log(`ID:       ${market.id}`);
    console.log(`Title:    ${market.title}`);
    console.log(`Platform: ${market.platform}`);
    console.log(`URL:      ${market.url}`);
    if (market.endDate) console.log(`Ends:     ${market.endDate.toISOString()}`);
    if (market.liquidity) console.log(`Liquidity: M$${market.liquidity.toFixed(0)} (Mana/play money)`);

    console.log('\n💰 Outcomes:');
    market.outcomes.forEach(outcome => {
      console.log(`  ${outcome.name.padEnd(10)} - ${outcome.price.toFixed(4)} (Type: ${outcome.price.constructor.name})`);
    });

    // Verify sum = 1.0
    const sum = market.outcomes[0].price.plus(market.outcomes[1].price);
    console.log(`\n🧮 Price Sum: ${sum.toFixed(6)}`);

    if (sum.equals(1)) {
      console.log('✅ Perfect sum = 1.0 (as expected for Manifold)');
    } else {
      console.log(`⚠️  Sum differs from 1.0 by ${sum.minus(1).abs().toFixed(6)}`);
    }

    // Show all markets
    console.log('\n\n📋 All Fetched Markets:');
    console.log('─'.repeat(70));
    markets.forEach((m, i) => {
      const yesPrice = m.outcomes.find(o => o.name === 'Yes')?.price.toFixed(2) || '?';
      console.log(`${i + 1}. [${yesPrice}] ${m.title.substring(0, 60)}${m.title.length > 60 ? '...' : ''}`);
    });

    console.log('\n' + '─'.repeat(70));
    console.log(`\n✅ Successfully fetched ${markets.length} binary markets`);
    console.log('✅ Manifold adapter is working correctly');
    console.log('\n🎉 Ready for arbitrage scanning!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
