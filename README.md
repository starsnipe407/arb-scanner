# Arbitrage Scanner

Prediction Market Arbitrage Scanner - Find "Sure Bets" between PolyMarket and Kalshi.

## Day 1 Progress ✅
- TypeScript project initialized
- Core dependencies installed (axios, zod, decimal.js)
- PolyMarket adapter created with Zod validation
- Type-safe StandardMarket interface

## Run the Day 1 Test

```bash
npm run dev
```

This will fetch 5 markets from PolyMarket and display:
- Market details
- Outcome prices (using Decimal.js for precision)
- Price sum validation

## Project Structure

```
arb-scanner/
├── src/
│   ├── adapters/
│   │   └── polymarket.ts    # PolyMarket API adapter
│   ├── types.ts              # Type definitions
│   └── index.ts              # Main entry point (Day 1 test)
├── package.json
├── tsconfig.json
└── .env.example
```

## Next Steps
- [ ] Add Kalshi adapter (when you get API access)
- [ ] Build fuzzy matching engine
- [ ] Implement arbitrage calculator
- [ ] Add BullMQ for real-time scanning
