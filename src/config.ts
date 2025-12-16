/**
 * Configuration Management
 * 
 * Centralize all configuration values instead of hardcoding them throughout the codebase.
 * This makes the system easier to tune and maintain.
 */

import { Decimal } from 'decimal.js';

export const CONFIG = {
  /**
   * API Configuration
   */
  api: {
    polymarket: {
      baseUrl: 'https://gamma-api.polymarket.com',
      timeout: 10000, // ms
      defaultLimit: 50,
      maxLimit: 500,
    },
    manifold: {
      baseUrl: 'https://api.manifold.markets/v0',
      timeout: 10000, // ms
      defaultLimit: 50,
      maxLimit: 500,
    },
  },

  /**
   * Matching Configuration
   */
  matching: {
    // Minimum similarity score (0-1) to consider a match
    threshold: 0.60,
    
    // Date range filter: markets ending >X days apart are different events
    maxDateDiffDays: 30,
    
    // Minimum keyword overlap required
    minKeywordOverlap: 2,
    
    // Percentage of smaller keyword set that must overlap
    minKeywordOverlapPercent: 0.4,

    // Fuse.js configuration
    fuse: {
      ignoreLocation: true,
      findAllMatches: true,
      minMatchCharLength: 3,
    },
  },

  /**
   * Fee Configuration
   */
  fees: {
    polymarket: new Decimal(0.02), // 2%
    kalshi: new Decimal(0.07), // 7%
    manifold: new Decimal(0), // 0% (play money)
  },

  /**
   * Arbitrage Thresholds
   */
  arbitrage: {
    // Minimum ROI to consider profitable (helps filter out tiny gains)
    minROI: new Decimal(0.01), // 1%
    
    // Minimum liquidity to consider (avoid illiquid markets)
    minLiquidity: new Decimal(100), // $100
  },

  /**
   * Logging Configuration
   */
  logging: {
    verbose: false, // Set to true for detailed logs
    showProgressDots: true, // Show progress during scanning
  },
} as const;
