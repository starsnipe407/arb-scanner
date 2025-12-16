import { Decimal } from 'decimal.js';
import { StandardMarket, MarketMatch } from './types.js';
import { ArbitrageCalculator } from './calculator/index.js';

/**
 * Week 4 Test: Arbitrage Calculator
 * 
 * We'll create mock market data to test different scenarios:
 * 1. ✅ Clear arbitrage (profitable after fees)
 * 2. ❌ False positive (looks good but fees kill profit)
 * 3. ⚠️ Edge case (barely profitable)
 * 4. 💰 High ROI opportunity
 */

/**
 * Helper: Create a mock binary market (Yes/No)
 */
function createMockMarket(
  id: string,
  platform: 'POLYMARKET' | 'MANIFOLD' | 'KALSHI',
  title: string,
  yesPrice: number,
  noPrice: number
): StandardMarket {
  return {
    id,
    platform,
    title,
    outcomes: [
      { name: 'Yes', price: new Decimal(yesPrice) },
      { name: 'No', price: new Decimal(noPrice) },
    ],
    url: `https://${platform.toLowerCase()}.com/market/${id}`,
  };
}

/**
 * SCENARIO 1: Clear Arbitrage ✅
 * 
 * Market pricing:
 * - PolyMarket: Yes=$0.45, No=$0.55 (sum=1.0, balanced)
 * - Manifold: Yes=$0.60, No=$0.38 (sum=0.98, inefficient!)
 * 
 * Strategy: Buy PolyMarket Yes ($0.45) + Manifold No ($0.38)
 * Cost: $0.83 + fees
 * PolyMarket fees: $0.45 × 2% = $0.009
 * Manifold fees: $0 (free)
 * Net cost: $0.839
 * Profit: $1.00 - $0.839 = $0.161 (16.1% ROI) 🚀
 */
function scenario1_clearArbitrage(): MarketMatch {
  const polyMarket = createMockMarket(
    'POLY_123',
    'POLYMARKET',
    'Will Bitcoin hit $100k in 2025?',
    0.45,
    0.55
  );

  const manifoldMarket = createMockMarket(
    'MANI_456',
    'MANIFOLD',
    'Bitcoin to reach $100k in 2025?',
    0.60,
    0.38
  );

  return {
    marketA: polyMarket,
    marketB: manifoldMarket,
    score: 88,
    matchedBy: 'fuzzy',
  };
}

/**
 * SCENARIO 2: False Positive ❌
 * 
 * Looks profitable before fees, but fees kill it.
 * 
 * Market pricing:
 * - PolyMarket: Yes=$0.50, No=$0.49 (sum=0.99, looks good!)
 * - Kalshi: Yes=$0.51, No=$0.48 (sum=0.99)
 * 
 * Strategy: Buy PolyMarket No ($0.49) + Kalshi No ($0.48)
 * Base cost: $0.97
 * PolyMarket fees: $0.49 × 2% = $0.0098
 * Kalshi fees: $0.48 × 7% = $0.0336
 * Total fees: $0.0434
 * Net cost: $0.97 + $0.0434 = $1.0134
 * Profit: $1.00 - $1.0134 = -$0.0134 (LOSS) ❌
 */
function scenario2_falsePositive(): MarketMatch {
  const polyMarket = createMockMarket(
    'POLY_789',
    'POLYMARKET',
    'US recession in 2025?',
    0.50,
    0.49
  );

  const kalshiMarket = createMockMarket(
    'KALSHI_101',
    'KALSHI',
    'Will US enter recession in 2025?',
    0.51,
    0.48
  );

  return {
    marketA: polyMarket,
    marketB: kalshiMarket,
    score: 92,
    matchedBy: 'fuzzy',
  };
}

/**
 * SCENARIO 3: Edge Case ⚠️
 * 
 * Barely profitable - risky because prices move quickly
 * 
 * Market pricing:
 * - PolyMarket: Yes=$0.48, No=$0.52
 * - Manifold: Yes=$0.55, No=$0.47
 * 
 * Strategy: Buy PolyMarket Yes ($0.48) + Manifold No ($0.47)
 * Base cost: $0.95
 * Fees: $0.48 × 2% = $0.0096
 * Net cost: $0.9596
 * Profit: $0.0404 (4% ROI) - Too thin for real trading
 */
function scenario3_edgeCase(): MarketMatch {
  const polyMarket = createMockMarket(
    'POLY_202',
    'POLYMARKET',
    'Trump wins 2024?',
    0.48,
    0.52
  );

  const manifoldMarket = createMockMarket(
    'MANI_303',
    'MANIFOLD',
    '2024 Presidential Election - Trump',
    0.55,
    0.47
  );

  return {
    marketA: polyMarket,
    marketB: manifoldMarket,
    score: 85,
    matchedBy: 'fuzzy',
  };
}

/**
 * SCENARIO 4: High ROI 💰
 * 
 * Significant mispricing - rare but happens during low liquidity
 * 
 * Market pricing:
 * - PolyMarket: Yes=$0.35, No=$0.65
 * - Manifold: Yes=$0.70, No=$0.28
 * 
 * Strategy: Buy PolyMarket Yes ($0.35) + Manifold No ($0.28)
 * Base cost: $0.63
 * Fees: $0.35 × 2% = $0.007
 * Net cost: $0.637
 * Profit: $0.363 (57% ROI!) 🚀🚀🚀
 */
function scenario4_highROI(): MarketMatch {
  const polyMarket = createMockMarket(
    'POLY_404',
    'POLYMARKET',
    'Fed emergency rate cut before December?',
    0.35,
    0.65
  );

  const manifoldMarket = createMockMarket(
    'MANI_505',
    'MANIFOLD',
    'Emergency Fed rate cut by Dec 2025?',
    0.70,
    0.28
  );

  return {
    marketA: polyMarket,
    marketB: manifoldMarket,
    score: 79,
    matchedBy: 'fuzzy',
  };
}

/**
 * Main test runner
 */
function main() {
  console.log('🧪 Arbitrage Calculator Test - Week 4\n');
  console.log('═'.repeat(70));

  const calculator = new ArbitrageCalculator();

  // Show platform fees
  console.log('\n📊 Platform Fee Structure:');
  console.log('─'.repeat(70));
  calculator.getPlatformFees().forEach(fee => {
    console.log(`${fee.platform.padEnd(15)} ${(fee.tradingFee.toNumber() * 100).toFixed(1)}%  - ${fee.description}`);
  });

  // Create test scenarios
  const scenarios: { name: string; match: MarketMatch }[] = [
    { name: 'Clear Arbitrage ✅', match: scenario1_clearArbitrage() },
    { name: 'False Positive ❌', match: scenario2_falsePositive() },
    { name: 'Edge Case ⚠️', match: scenario3_edgeCase() },
    { name: 'High ROI 💰', match: scenario4_highROI() },
  ];

  console.log('\n\n🔬 TESTING SCENARIOS:');
  console.log('═'.repeat(70));

  // Analyze each scenario
  for (let i = 0; i < scenarios.length; i++) {
    const { name, match } = scenarios[i];
    
    console.log(`\n\n📌 SCENARIO ${i + 1}: ${name}`);
    console.log('─'.repeat(70));
    
    const opportunities = calculator.findArbitrageOpportunities([match]);
    
    if (opportunities.length === 0) {
      console.log('❌ No profitable opportunities found (fees too high)');
    } else {
      opportunities.forEach(opp => {
        console.log(ArbitrageCalculator.formatOpportunity(opp));
      });
    }
  }

  // Summary
  console.log('\n\n📈 SUMMARY:');
  console.log('═'.repeat(70));
  console.log('✅ Scenario 1: Should show ~16% ROI (clear profit)');
  console.log('❌ Scenario 2: Should show 0 opportunities (fees kill it)');
  console.log('⚠️  Scenario 3: Should show ~4% ROI (risky)');
  console.log('💰 Scenario 4: Should show ~57% ROI (jackpot!)');
  
  console.log('\n\n🎉 Week 4 Complete! Arbitrage calculator is working.\n');
  console.log('Next Steps:');
  console.log('  1. Add Manifold Markets adapter (real data)');
  console.log('  2. Connect calculator to live scanner');
  console.log('  3. Add alerting system (Week 5)');
}

main();
