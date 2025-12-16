import 'dotenv/config';
import { PolyMarketAdapter } from './adapters/polymarket.js';
import { ManifoldAdapter } from './adapters/manifold.js';
import { MarketMatcher } from './matcher/index.js';
import { ArbitrageCalculator } from './calculator/index.js';
import Decimal from 'decimal.js';


/**
 * 🚀 COMPLETE ARBITRAGE SCANNER - ALL PIECES TOGETHER
 * 
 * This is the culmination of Weeks 1-4:
 * 1. Fetch markets from PolyMarket (real money)
 * 2. Fetch markets from Manifold (play money)
 * 3. Match markets that represent the same event
 * 4. Calculate arbitrage opportunities
 * 5. Display profitable trades
 * 
 * NOTE: This is play money arbitrage (Manifold uses Mana)
 * But the logic is IDENTICAL for real money platforms.
 */

async function main() {
  console.log('🤖 PREDICTION MARKET ARBITRAGE SCANNER');
  console.log('═'.repeat(70));
  console.log('Scanning for arbitrage between PolyMarket and Manifold Markets');
  console.log('═'.repeat(70));

  try {
    // STEP 1: FETCH DATA
    console.log('\n📥 STEP 1: Fetching market data...\n');

    const polymarket = new PolyMarketAdapter();
    const manifold = new ManifoldAdapter();

    console.log('  → Fetching PolyMarket markets...');
    const polyMarkets = await polymarket.fetchMarkets(200);
    console.log(`  ✅ Fetched ${polyMarkets.length} markets from PolyMarket`);

    console.log('  → Fetching Manifold markets...');
    const manifoldMarkets = await manifold.fetchMarkets(200);
    console.log(`  ✅ Fetched ${manifoldMarkets.length} markets from Manifold`);

    // STEP 2: MATCH MARKETS
    console.log('\n\n🔍 STEP 2: Finding matching markets...\n');
    
    const matcher = new MarketMatcher();
    const matches = matcher.findMatches(polyMarkets, manifoldMarkets);

    if (matches.length === 0) {
      console.log('\n⚠️  No matching markets found.');
      console.log('This is normal - PolyMarket and Manifold often cover different events.');
      console.log('\nTips to improve matching:');
      console.log('  1. Increase market limit (currently 50 each)');
      console.log('  2. Lower matching threshold (currently 60%)');
      console.log('  3. Wait for major events (elections, sports, etc.)');
      return;
    }

    console.log(`\n✅ Found ${matches.length} matching pairs`);
    
    // Show matches
    console.log('\n📊 Matched Markets:');
    console.log('─'.repeat(70));
    matches.forEach((match, i) => {
      console.log(`\n${i + 1}. Match Score: ${match.score}%`);
      console.log(`   PolyMarket: "${match.marketA.title}"`);
      console.log(`   Manifold:   "${match.marketB.title}"`);
    });

    // STEP 3: CALCULATE ARBITRAGE
    console.log('\n\n💰 STEP 3: Analyzing for arbitrage opportunities...\n');

    const calculator = new ArbitrageCalculator();
    const opportunities = calculator.findArbitrageOpportunities(matches);

    if (opportunities.length === 0) {
      console.log('\n❌ No profitable arbitrage found.');
      console.log('\nWhy this happens:');
      console.log('  1. Markets are efficient (prices aligned)');
      console.log('  2. Fees eat up small price differences');
      console.log('  3. Need larger price discrepancies (>5%)');
      console.log('\nKeep scanning - opportunities appear during:');
      console.log('  • Breaking news events');
      console.log('  • Low liquidity periods');
      console.log('  • New market launches');
      return;
    }

    // STEP 4: DISPLAY RESULTS
    console.log('\n\n🚨 ARBITRAGE OPPORTUNITIES FOUND! 🚨');
    console.log('═'.repeat(70));

    // Sort by ROI (highest first)
    const sorted = opportunities.sort((a, b) => 
      b.roi.minus(a.roi).toNumber()
    );

    sorted.forEach((opp, i) => {
      console.log(`\n\n--- OPPORTUNITY ${i + 1} ---`);
      console.log(ArbitrageCalculator.formatOpportunity(opp));
    });

    // SUMMARY
    console.log('\n\n📈 SCAN SUMMARY');
    console.log('═'.repeat(70));
    console.log(`Markets scanned (PolyMarket): ${polyMarkets.length}`);
    console.log(`Markets scanned (Manifold):   ${manifoldMarkets.length}`);
    console.log(`Matching pairs found:         ${matches.length}`);
    console.log(`Profitable opportunities:     ${opportunities.length}`);
    
    if (opportunities.length > 0) {
      const bestROI = sorted[0].roi;
      const avgROI = sorted.reduce((sum, opp) => sum.plus(opp.roi), new Decimal(0))
        .dividedBy(opportunities.length);
      
      console.log(`Best ROI:                     ${bestROI.toFixed(2)}%`);
      console.log(`Average ROI:                  ${avgROI.toFixed(2)}%`);
    }

    console.log('\n' + '═'.repeat(70));
    console.log('\n⚠️  IMPORTANT NOTES:');
    console.log('  • Manifold uses play money (Mana), not USD');
    console.log('  • Real arbitrage requires both platforms using real money');
    console.log('  • Prices change rapidly - execute quickly or opportunity vanishes');
    console.log('  • This demonstrates the LOGIC - works same for real money platforms');

    console.log('\n\n🎉 Scanner Complete!');

  } catch (error) {
    console.error('\n❌ Scanner Error:', error);
    process.exit(1);
  }
}

main();
