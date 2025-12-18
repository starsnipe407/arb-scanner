import 'dotenv/config';
import { PolyMarketAdapter } from '../adapters/polymarket.js';
import { MarketMatcher } from '../matcher/index.js';
import { StandardMarket } from '../types.js';

/**
 * Week 3 Test: Fuzzy Matching Demo
 * 
 * Since we don't have Kalshi API access yet, we'll simulate it by:
 * 1. Fetching real PolyMarket data
 * 2. Creating "fake Kalshi" markets with rephrased titles
 * 3. Testing if our matcher can find the matches
 */

/**
 * Simulate Kalshi by rephrasing PolyMarket titles
 * This demonstrates what the matcher will face in reality
 */
function createSimulatedKalshiMarkets(polyMarkets: StandardMarket[]): StandardMarket[] {
  return polyMarkets.slice(0, 3).map(market => {
    // Take the PolyMarket title and rephrase it like Kalshi would
    const simulatedTitle = rephraseTitle(market.title);

    return {
      ...market,
      id: `KALSHI_${market.id}`, // Different ID
      platform: 'KALSHI' as const,
      title: simulatedTitle, // Rephrased title
      url: `https://kalshi.com/markets/${market.id}`,
    };
  });
}

/**
 * Rephrase titles to simulate how different platforms word the same event
 * 
 * Example transformations:
 * "Will X happen?" → "X to occur?"
 * "Trump win 2024?" → "2024 Presidential Election - Trump"
 */
function rephraseTitle(title: string): string {
  // Simple rephrasing rules (in reality, each platform has different styles)
  return title
    .replace(/^Will\s+/i, '') // Remove "Will"
    .replace(/\?$/, '') // Remove question mark
    .replace(/\sin\s+(\d{4})/i, ' $1') // "in 2025" → "2025"
    .trim();
}

async function main() {
  console.log('🧪 Fuzzy Matcher Test - Week 3\n');
  console.log('═'.repeat(70));

  // STEP 1: Fetch real PolyMarket data
  const polymarket = new PolyMarketAdapter();
  console.log('\n📥 Fetching markets from PolyMarket...');
  const polyMarkets = await polymarket.fetchMarkets(10);
  console.log(`✅ Fetched ${polyMarkets.length} markets`);

  // STEP 2: Create simulated Kalshi markets (rephrased versions)
  console.log('\n🎭 Creating simulated Kalshi markets (rephrased titles)...');
  const kalshiMarkets = createSimulatedKalshiMarkets(polyMarkets);
  
  console.log('\nSimulated Kalshi Markets:');
  kalshiMarkets.forEach((market, i) => {
    console.log(`  ${i + 1}. "${market.title}"`);
  });

  // STEP 3: Run the matcher
  console.log('\n' + '═'.repeat(70));
  const matcher = new MarketMatcher();
  const matches = matcher.findMatches(polyMarkets, kalshiMarkets);

  // STEP 4: Display results
  console.log('\n📊 MATCHING RESULTS:');
  console.log('═'.repeat(70));

  if (matches.length === 0) {
    console.log('❌ No matches found (threshold might be too strict)');
  } else {
    matches.forEach((match, i) => {
      console.log(MarketMatcher.formatMatch(match));
    });
  }

  // STEP 5: Analysis
  console.log('\n📈 ANALYSIS:');
  console.log('─'.repeat(70));
  console.log(`Total PolyMarket markets: ${polyMarkets.length}`);
  console.log(`Total Kalshi markets: ${kalshiMarkets.length}`);
  console.log(`Naive comparisons needed: ${polyMarkets.length * kalshiMarkets.length}`);
  console.log(`Matches found: ${matches.length}`);
  console.log(`Expected matches: ${kalshiMarkets.length} (we created 3 rephrased versions)`);
  
  const successRate = (matches.length / kalshiMarkets.length) * 100;
  console.log(`\n🎯 Success Rate: ${successRate.toFixed(0)}%`);

  if (successRate === 100) {
    console.log('✅ Perfect! All simulated matches were found.');
  } else if (successRate >= 66) {
    console.log('⚠️  Good, but some matches were missed (might need to adjust threshold).');
  } else {
    console.log('❌ Matcher needs tuning. Check pre-filtering rules.');
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🎉 Week 3 Fuzzy Matching Complete!\n');
  console.log('Next Steps:');
  console.log('  1. Get Kalshi API access');
  console.log('  2. Test with real Kalshi data');
  console.log('  3. Build the arbitrage calculator (Week 4)');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
