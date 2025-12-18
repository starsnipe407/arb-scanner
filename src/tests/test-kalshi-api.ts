/**
 * Test Kalshi API - Verify we can fetch market data without authentication
 * 
 * API Documentation: https://docs.kalshi.com/api-reference/market/get-markets
 */

import { logger } from '../utils/logger.js';

interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  market_type: 'binary' | 'scalar';
  title: string;
  subtitle: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status: 'unopened' | 'open' | 'paused' | 'closed' | 'settled';
  close_time: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  volume?: number;
  volume_24h?: number;
  open_interest?: number;
  liquidity?: number;
  category?: string;
}

interface KalshiResponse {
  markets: KalshiMarket[];
  cursor?: string;
}

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

/**
 * Fetch markets from Kalshi API
 */
async function fetchKalshiMarkets(limit: number = 10): Promise<KalshiMarket[]> {
  const url = `${KALSHI_API_BASE}/markets?limit=${limit}&status=open`;
  
  logger.info(`Fetching markets from Kalshi API...`);
  logger.debug(`URL: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kalshi API request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as KalshiResponse;
    
    logger.success(`Fetched ${data.markets.length} markets from Kalshi`);
    
    return data.markets;
  } catch (error) {
    logger.error('Failed to fetch Kalshi markets:', error);
    throw error;
  }
}

/**
 * Display market information
 */
function displayMarket(market: KalshiMarket, index: number): void {
  console.log(`\n${index + 1}. ${market.title}`);
  console.log(`   Ticker: ${market.ticker}`);
  console.log(`   Status: ${market.status}`);
  console.log(`   Category: ${market.category || 'N/A'}`);
  console.log(`   Close Time: ${new Date(market.close_time).toLocaleString()}`);
  
  if (market.yes_ask !== undefined && market.no_ask !== undefined) {
    // Convert from cents to dollars
    const yesPrice = market.yes_ask / 100;
    const noPrice = market.no_ask / 100;
    console.log(`   Prices: YES $${yesPrice.toFixed(2)} | NO $${noPrice.toFixed(2)}`);
  }
  
  if (market.volume_24h !== undefined) {
    console.log(`   Volume (24h): ${market.volume_24h}`);
  }
  
  if (market.liquidity !== undefined) {
    console.log(`   Liquidity: $${(market.liquidity / 100).toFixed(2)}`);
  }
}

/**
 * Test Kalshi API integration
 */
async function testKalshiAPI() {
  console.log('🧪 TESTING KALSHI API');
  console.log('════════════════════════════════════════\n');

  try {
    // Test 1: Fetch markets
    console.log('Test 1: Fetching 10 open markets...\n');
    const markets = await fetchKalshiMarkets(10);

    if (markets.length === 0) {
      console.log('⚠️  No open markets found');
      return;
    }

    // Test 2: Display market details
    console.log(`\n✅ Successfully fetched ${markets.length} markets:\n`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    markets.forEach((market, index) => {
      displayMarket(market, index);
    });

    // Test 3: Analyze data structure
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('📊 DATA ANALYSIS:\n');
    
    const binaryMarkets = markets.filter(m => m.market_type === 'binary').length;
    const withPrices = markets.filter(m => m.yes_ask !== undefined).length;
    const withLiquidity = markets.filter(m => m.liquidity !== undefined).length;
    
    console.log(`Binary Markets: ${binaryMarkets}/${markets.length}`);
    console.log(`Markets with Prices: ${withPrices}/${markets.length}`);
    console.log(`Markets with Liquidity: ${withLiquidity}/${markets.length}`);
    
    // Test 4: Price format verification
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('💰 PRICE FORMAT TEST:\n');
    
    const firstMarketWithPrice = markets.find(m => m.yes_ask !== undefined);
    if (firstMarketWithPrice) {
      console.log(`Market: ${firstMarketWithPrice.title}`);
      console.log(`yes_ask (raw): ${firstMarketWithPrice.yes_ask} cents`);
      console.log(`yes_ask (converted): $${(firstMarketWithPrice.yes_ask! / 100).toFixed(2)}`);
      
      if (firstMarketWithPrice.no_ask !== undefined) {
        console.log(`no_ask (raw): ${firstMarketWithPrice.no_ask} cents`);
        console.log(`no_ask (converted): $${(firstMarketWithPrice.no_ask / 100).toFixed(2)}`);
        
        const total = (firstMarketWithPrice.yes_ask! + firstMarketWithPrice.no_ask!) / 100;
        console.log(`Total (YES + NO): $${total.toFixed(2)}`);
        console.log(`Should equal: $1.00`);
        console.log(`Difference: $${Math.abs(1 - total).toFixed(4)}`);
      }
    }

    // Test 5: Sample market for adapter development
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('🔍 SAMPLE MARKET (for adapter development):\n');
    console.log(JSON.stringify(markets[0], null, 2));

    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('Next steps:');
    console.log('1. Review the data structure above');
    console.log('2. Create KalshiAdapter based on PolyMarketAdapter');
    console.log('3. Map Kalshi format → StandardMarket interface');
    console.log('4. Update config.ts with Kalshi fee (7%)');
    console.log('5. Add Kalshi to scanner workflow\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

testKalshiAPI();
