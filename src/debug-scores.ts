import 'dotenv/config';
import { PolyMarketAdapter } from './adapters/polymarket.js';
import Fuse from 'fuse.js';

/**
 * Debug script to understand why some matches are missed
 * This shows the raw Fuse.js scores for each comparison
 */

async function debug() {
  const polymarket = new PolyMarketAdapter();
  const polyMarkets = await polymarket.fetchMarkets(10);

  // Test against first 3 rephrased titles
  const testPairs = [
    {
      poly: "US recession in 2025?",
      kalshi: "US recession 2025"
    },
    {
      poly: "Fed emergency rate cut in 2025?",
      kalshi: "Fed emergency rate cut 2025"
    },
    {
      poly: "Will Tether become insolvent in 2025?",
      kalshi: "Tether insolvent 2025"
    }
  ];

  console.log('\n🔍 Fuse.js Score Analysis\n');
  console.log('═'.repeat(70));

  testPairs.forEach(pair => {
    const fuse = new Fuse([{ title: pair.kalshi }], {
      keys: ['title'],
      includeScore: true,
      threshold: 1.0, // Accept all scores
    });

    const result = fuse.search(pair.poly);
    const fuseScore = result[0]?.score || 1;
    const ourScore = Math.round((1 - fuseScore) * 100);

    console.log(`\nPolyMarket: "${pair.poly}"`);
    console.log(`Kalshi:     "${pair.kalshi}"`);
    console.log(`Fuse Score: ${fuseScore.toFixed(3)} (lower is better)`);
    console.log(`Our Score:  ${ourScore}% (higher is better)`);
    console.log(`Status:     ${ourScore >= 85 ? '✅ MATCH' : '❌ BELOW THRESHOLD'}`);
  });

  console.log('\n' + '═'.repeat(70));
}

debug();
