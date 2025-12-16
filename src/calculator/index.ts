import { Decimal } from 'decimal.js';
import { StandardMarket, MarketMatch, ArbitrageOpportunity, PlatformFees } from '../types.js';

/**
 * ArbitrageCalculator - The math engine that finds profit opportunities
 * 
 * HOW ARBITRAGE WORKS:
 * ────────────────────
 * Imagine two platforms pricing the same event differently:
 * 
 * PolyMarket: "Will it rain?" → Yes: $0.40, No: $0.60
 * Manifold:   "Will it rain?" → Yes: $0.65, No: $0.38
 * 
 * STRATEGY: Buy "Yes" on PolyMarket ($0.40) + Buy "No" on Manifold ($0.38)
 * 
 * OUTCOME 1 (It rains):
 *   - PolyMarket Yes pays $1.00 → Profit: $1.00 - $0.40 = $0.60
 *   - Manifold No pays $0.00 → Loss: $0.38
 *   - Net: $0.60 - $0.38 = $0.22 profit ✅
 * 
 * OUTCOME 2 (No rain):
 *   - PolyMarket Yes pays $0.00 → Loss: $0.40
 *   - Manifold No pays $1.00 → Profit: $1.00 - $0.38 = $0.62
 *   - Net: $0.62 - $0.40 = $0.22 profit ✅
 * 
 * Either way you win! (Before fees...)
 */
export class ArbitrageCalculator {
  // Platform fee structures (researched from official docs)
  private platformFees: PlatformFees[] = [
    {
      platform: 'POLYMARKET',
      tradingFee: new Decimal(0.02), // 2% trading fee
      description: 'PolyMarket charges ~2% on trades'
    },
    {
      platform: 'KALSHI',
      tradingFee: new Decimal(0.07), // 7% on profits (we simplify to 7% on trade)
      description: 'Kalshi charges ~7% on winning positions'
    },
    {
      platform: 'MANIFOLD',
      tradingFee: new Decimal(0), // Free (play money)
      description: 'Manifold has no fees (play money platform)'
    }
  ];

  /**
   * Find ALL arbitrage opportunities between matched markets
   * 
   * For each matched pair:
   * - Try Strategy 1: Buy outcome A on platform A + opposite on B
   * - Try Strategy 2: Buy outcome A on platform B + opposite on A
   * 
   * @param matches - Pairs of markets that represent the same event
   * @returns Array of profitable arbitrage opportunities
   */
  findArbitrageOpportunities(matches: MarketMatch[]): ArbitrageOpportunity[] {
    console.log(`\n💰 Analyzing ${matches.length} matched pairs for arbitrage...`);
    
    const opportunities: ArbitrageOpportunity[] = [];

    for (const match of matches) {
      // For each matched pair, check both strategies
      const opps = this.analyzeMarketPair(match);
      opportunities.push(...opps);
    }

    const profitable = opportunities.filter(opp => opp.isProfitable);
    
    console.log(`✅ Found ${profitable.length} profitable opportunities (out of ${opportunities.length} strategies tested)`);
    
    return profitable;
  }

  /**
   * Analyze a single matched pair for arbitrage
   * 
   * IMPORTANT: We must check BOTH directions because markets can have different outcomes
   * Example:
   * - Market A: ["Yes", "No"]
   * - Market B: ["Yes", "No"]
   * 
   * Strategy 1: Buy "Yes" on A + "No" on B
   * Strategy 2: Buy "No" on A + "Yes" on B
   */
  private analyzeMarketPair(match: MarketMatch): ArbitrageOpportunity[] {
    const { marketA, marketB } = match;
    const opportunities: ArbitrageOpportunity[] = [];

    // Only handle binary markets for now (Yes/No)
    // Multi-outcome markets are complex (TODO: Week 5+)
    if (marketA.outcomes.length !== 2 || marketB.outcomes.length !== 2) {
      return [];
    }

    // STRATEGY 1: Outcome 0 on A + Outcome 1 on B
    const opp1 = this.calculateArbitrage(
      marketA,
      marketB,
      0, // First outcome on A
      1, // Second outcome on B
    );
    if (opp1) opportunities.push(opp1);

    // STRATEGY 2: Outcome 1 on A + Outcome 0 on B
    const opp2 = this.calculateArbitrage(
      marketA,
      marketB,
      1, // Second outcome on A
      0, // First outcome on B
    );
    if (opp2) opportunities.push(opp2);

    return opportunities;
  }

  /**
   * CORE ARBITRAGE CALCULATION
   * 
   * This is where the magic happens. We calculate:
   * 1. Base cost (sum of two prices)
   * 2. Fees on each platform
   * 3. Net profit after fees
   * 4. ROI percentage
   * 
   * THE GOLDEN RULE:
   * If (cost + fees) < $1.00 → PROFIT! ✅
   */
  private calculateArbitrage(
    marketA: StandardMarket,
    marketB: StandardMarket,
    outcomeIndexA: number,
    outcomeIndexB: number,
  ): ArbitrageOpportunity | null {
    
    const outcomeA = marketA.outcomes[outcomeIndexA];
    const outcomeB = marketB.outcomes[outcomeIndexB];

    // Get prices (already Decimal objects)
    const priceA = outcomeA.price;
    const priceB = outcomeB.price;

    // Calculate base cost (before fees)
    const totalCost = priceA.plus(priceB);

    // If base cost >= 1.0, this can't be profitable even without fees
    if (totalCost.greaterThanOrEqualTo(1)) {
      return null; // Skip expensive calculation
    }

    // Get fee rates for each platform
    const feeRateA = this.getFeeRate(marketA.platform);
    const feeRateB = this.getFeeRate(marketB.platform);

    // Calculate fees
    // Fee = price × fee_rate
    // Example: $0.40 × 0.02 (2%) = $0.008
    const feesA = priceA.times(feeRateA);
    const feesB = priceB.times(feeRateB);
    const totalFees = feesA.plus(feesB);

    // Net cost = what you actually pay
    const netCost = totalCost.plus(totalFees);

    // Profit margin = payout ($1.00) - net cost
    // Example: $1.00 - $0.91 = $0.09 profit
    const profitMargin = new Decimal(1).minus(netCost);

    // Check if profitable
    const isProfitable = profitMargin.greaterThan(0);

    // ROI = (profit / cost) × 100
    // Example: $0.09 / $0.91 = 9.89% ROI
    const roi = isProfitable 
      ? profitMargin.dividedBy(netCost).times(100)
      : new Decimal(0);

    return {
      marketA,
      marketB,
      outcomeA: outcomeA.name,
      outcomeB: outcomeB.name,
      priceA,
      priceB,
      totalCost,
      feesA,
      feesB,
      totalFees,
      netCost,
      profitMargin,
      roi,
      isProfitable,
      timestamp: new Date(),
    };
  }

  /**
   * Get the fee rate for a platform
   */
  private getFeeRate(platform: StandardMarket['platform']): Decimal {
    const feeConfig = this.platformFees.find(f => f.platform === platform);
    return feeConfig?.tradingFee || new Decimal(0);
  }

  /**
   * Format an arbitrage opportunity for display
   */
  static formatOpportunity(opp: ArbitrageOpportunity): string {
    const emoji = opp.isProfitable ? '🚨' : '⚠️';
    
    return `
${emoji} ${opp.isProfitable ? 'ARBITRAGE FOUND' : 'NEAR MISS'} ${emoji}
${'═'.repeat(70)}
Event: "${opp.marketA.title}"

STRATEGY:
  Buy "${opp.outcomeA}" on ${opp.marketA.platform} @ $${opp.priceA.toFixed(4)}
  Buy "${opp.outcomeB}" on ${opp.marketB.platform} @ $${opp.priceB.toFixed(4)}

MATH:
  Base Cost:    $${opp.totalCost.toFixed(4)} (${opp.priceA.toFixed(4)} + ${opp.priceB.toFixed(4)})
  Fees (${opp.marketA.platform}):  $${opp.feesA.toFixed(4)}
  Fees (${opp.marketB.platform}): $${opp.feesB.toFixed(4)}
  Total Fees:   $${opp.totalFees.toFixed(4)}
  ──────────────────────────────────
  Net Cost:     $${opp.netCost.toFixed(4)}
  Payout:       $1.0000 (guaranteed)
  Profit:       $${opp.profitMargin.toFixed(4)} ${opp.isProfitable ? '✅' : '❌'}
  ROI:          ${opp.roi.toFixed(2)}%

EXPLANATION:
  No matter which outcome happens, you collect $1.00.
  Your total cost (including fees) is $${opp.netCost.toFixed(4)}.
  ${opp.isProfitable 
    ? `Profit: $${opp.profitMargin.toFixed(4)} per $1 bet.`
    : `Loss: $${opp.profitMargin.abs().toFixed(4)} (fees ate the profit).`}

${'═'.repeat(70)}
`;
  }

  /**
   * Get platform fee information
   */
  getPlatformFees(): PlatformFees[] {
    return this.platformFees;
  }
}
