/**
 * Job Queue System
 * 
 * Uses BullMQ to schedule and process background jobs
 */

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { redis } from './redis.js';
import { logger } from '../utils/logger.js';
import { PolyMarketAdapter } from '../adapters/polymarket.js';
import { ManifoldAdapter } from '../adapters/manifold.js';
import { MarketMatcher } from '../matcher/index.js';
import { ArbitrageCalculator } from '../calculator/index.js';
import { Cache, CacheKeys } from './redis.js';
import { StandardMarket, ArbitrageOpportunity } from '../types.js';
import { Decimal } from 'decimal.js';
import { sendAlerts, meetsAlertThreshold } from './alerts.js';

/**
 * Job data types
 */
export interface ScanJobData {
  platformA: string;
  platformB: string;
  limit: number;
}

export interface ScanResult {
  timestamp: number;
  opportunities: ArbitrageOpportunity[];
  marketsScanned: {
    [platform: string]: number;
  };
  matchesFound: number;
  duration: number;
}

/**
 * Queue names
 */
export const QUEUE_NAMES = {
  SCAN: 'arbitrage-scan',
};

/**
 * Create the scan queue
 */
export const scanQueue = new Queue<ScanJobData>(QUEUE_NAMES.SCAN, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // Remove after 24 hours
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
    },
  },
});

/**
 * Queue events for monitoring
 */
const queueEvents = new QueueEvents(QUEUE_NAMES.SCAN, {
  connection: redis,
});

queueEvents.on('completed', ({ jobId }) => {
  logger.info(`Job ${jobId} completed`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Job ${jobId} failed: ${failedReason}`);
});

/**
 * Process scan jobs
 */
async function processScanJob(job: Job<ScanJobData>): Promise<ScanResult> {
  const { platformA, platformB, limit } = job.data;
  const startTime = Date.now();
  
  logger.info(`Starting scan job ${job.id}: ${platformA} vs ${platformB}`);

  try {
    // Update job progress
    await job.updateProgress(10);

    // Step 1: Fetch markets (with caching)
    const [marketsA, marketsB] = await Promise.all([
      fetchMarketsWithCache(platformA, limit),
      fetchMarketsWithCache(platformB, limit),
    ]);

    await job.updateProgress(40);

    logger.info(`Fetched ${marketsA.length} from ${platformA}, ${marketsB.length} from ${platformB}`);

    // Step 2: Find matches
    const matcher = new MarketMatcher();
    const matches = matcher.findMatches(marketsA, marketsB);
    
    await job.updateProgress(70);

    logger.info(`Found ${matches.length} matches`);

    // Step 3: Calculate arbitrage
    const calculator = new ArbitrageCalculator();
    const opportunities = calculator.findArbitrageOpportunities(matches);

    await job.updateProgress(90);

    logger.info(`Found ${opportunities.length} arbitrage opportunities`);

    // Step 4: Send alerts for qualifying opportunities
    const alertableOpportunities = opportunities.filter(meetsAlertThreshold);
    if (alertableOpportunities.length > 0) {
      logger.info(`${alertableOpportunities.length} opportunities meet alert threshold`);
      await sendAlerts(alertableOpportunities);
    }

    // Cache results
    const result: ScanResult = {
      timestamp: Date.now(),
      opportunities,
      marketsScanned: {
        [platformA]: marketsA.length,
        [platformB]: marketsB.length,
      },
      matchesFound: matches.length,
      duration: Date.now() - startTime,
    };

    await Cache.set(CacheKeys.opportunities(), result, 120); // Cache for 2 minutes
    await Cache.set(CacheKeys.scanResults(result.timestamp), result, 3600); // Keep for 1 hour

    await job.updateProgress(100);

    logger.success(`Scan completed in ${result.duration}ms - ${opportunities.length} opportunities`);

    return result;
  } catch (error) {
    logger.error(`Scan job ${job.id} failed:`, error);
    throw error;
  }
}

/**
 * Fetch markets with caching
 */
async function fetchMarketsWithCache(platform: string, limit: number): Promise<StandardMarket[]> {
  const cacheKey = CacheKeys.markets(platform);
  
  // Try cache first
  const cached = await Cache.get<StandardMarket[]>(cacheKey);
  if (cached) {
    logger.debug(`Using cached markets for ${platform}`);
    // Deserialize dates and Decimals from cached data
    return deserializeMarkets(cached);
  }

  // Fetch fresh data
  let markets: StandardMarket[] = [];
  
  if (platform === 'POLYMARKET') {
    const adapter = new PolyMarketAdapter();
    markets = await adapter.fetchMarkets(limit);
  } else if (platform === 'MANIFOLD') {
    const adapter = new ManifoldAdapter();
    markets = await adapter.fetchMarkets(limit);
  }

  // Cache for 2 minutes (markets don't change that fast)
  await Cache.set(cacheKey, markets, 120);
  
  return markets;
}

/**
 * Deserialize markets from cache
 * Converts date strings back to Date objects and price strings back to Decimals
 */
function deserializeMarkets(markets: any[]): StandardMarket[] {
  return markets.map(market => ({
    ...market,
    endDate: market.endDate ? new Date(market.endDate) : undefined,
    liquidity: market.liquidity ? new Decimal(market.liquidity) : undefined,
    outcomes: market.outcomes.map((outcome: any) => ({
      ...outcome,
      price: new Decimal(outcome.price),
    })),
  }));
}

/**
 * Create and start the worker
 */
export function createScanWorker() {
  const worker = new Worker<ScanJobData, ScanResult>(
    QUEUE_NAMES.SCAN,
    processScanJob,
    {
      connection: redis,
      concurrency: 1, // Process one scan at a time
    }
  );

  worker.on('completed', (job, result) => {
    logger.success(`Worker completed job ${job.id}: ${result.opportunities.length} opportunities`);
  });

  worker.on('failed', (job, error) => {
    logger.error(`Worker failed job ${job?.id}:`, error);
  });

  worker.on('error', (error) => {
    logger.error('Worker error:', error);
  });

  return worker;
}

/**
 * Add a scan job to the queue
 */
export async function addScanJob(data: ScanJobData): Promise<Job<ScanJobData>> {
  const job = await scanQueue.add('scan', data, {
    jobId: `scan-${Date.now()}`, // Unique ID
  });
  
  logger.info(`Added scan job ${job.id} to queue`);
  return job;
}

/**
 * Add a recurring scan job
 * 
 * @param data - Job data
 * @param intervalSeconds - How often to run (default: 60 seconds)
 */
export async function addRecurringScanJob(data: ScanJobData, intervalSeconds: number = 60): Promise<void> {
  const jobName = `recurring-scan-${data.platformA}-${data.platformB}`;
  
  // Remove existing recurring job if any
  try {
    await scanQueue.removeRepeatable(jobName, {
      every: intervalSeconds * 1000,
    });
    logger.info(`Removed existing recurring job: ${jobName}`);
  } catch (error) {
    // Job doesn't exist yet, that's fine
    logger.debug(`No existing recurring job to remove: ${jobName}`);
  }

  // Add new recurring job
  await scanQueue.add(jobName, data, {
    repeat: {
      every: intervalSeconds * 1000, // Convert to milliseconds
    },
  });

  logger.success(`Added recurring scan job: ${jobName} (every ${intervalSeconds}s)`);
}

/**
 * Get queue stats
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    scanQueue.getWaitingCount(),
    scanQueue.getActiveCount(),
    scanQueue.getCompletedCount(),
    scanQueue.getFailedCount(),
    scanQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Clear all jobs (use carefully!)
 */
export async function clearQueue(): Promise<void> {
  await scanQueue.drain();
  await scanQueue.clean(0, 0);
  logger.warn('Queue cleared');
}

/**
 * Gracefully close queue and worker
 */
export async function closeQueue(): Promise<void> {
  await scanQueue.close();
  await queueEvents.close();
  logger.info('Queue closed');
}
