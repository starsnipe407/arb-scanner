/**
 * Alert Service
 * 
 * Sends notifications when arbitrage opportunities are found
 * Supports Discord webhooks (can be extended for Telegram, Email, etc.)
 */

import { ArbitrageOpportunity } from '../types.js';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';
import { Cache, CacheKeys } from './redis.js';

/**
 * Discord embed structure
 */
interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

/**
 * Discord webhook payload
 */
interface DiscordWebhookPayload {
  username?: string;
  avatar_url?: string;
  embeds: DiscordEmbed[];
}

/**
 * Check if an opportunity meets alert thresholds
 */
export function meetsAlertThreshold(opportunity: ArbitrageOpportunity): boolean {
  const profitPercent = opportunity.roi.mul(100).toNumber();
  const profitAmount = opportunity.profitMargin.toNumber();

  return (
    profitPercent >= CONFIG.alerts.minProfitPercent &&
    profitAmount >= CONFIG.alerts.minProfitAmount
  );
}

/**
 * Check if we've already alerted for this opportunity recently (cooldown)
 */
async function isInCooldown(opportunity: ArbitrageOpportunity): Promise<boolean> {
  const cacheKey = CacheKeys.alertSent(
    opportunity.marketA.id,
    opportunity.marketB.id
  );
  
  const cached = await Cache.get(cacheKey);
  return cached !== null;
}

/**
 * Mark opportunity as alerted (set cooldown)
 */
async function markAlerted(opportunity: ArbitrageOpportunity): Promise<void> {
  const cacheKey = CacheKeys.alertSent(
    opportunity.marketA.id,
    opportunity.marketB.id
  );
  
  const ttl = CONFIG.alerts.cooldownMinutes * 60; // Convert to seconds
  await Cache.set(cacheKey, { timestamp: Date.now() }, ttl);
}

/**
 * Format arbitrage opportunity as Discord embed
 */
function formatDiscordEmbed(opportunity: ArbitrageOpportunity): DiscordEmbed {
  const profitPercent = opportunity.roi.mul(100).toNumber().toFixed(2);
  const profitAmount = opportunity.profitMargin.toNumber().toFixed(2);
  
  // Color: Green for profitable
  const color = 0x00ff00; // Green

  // Format end date
  const endDate = opportunity.marketA.endDate 
    ? new Date(opportunity.marketA.endDate).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Unknown';

  return {
    title: '🚨 ARBITRAGE OPPORTUNITY FOUND!',
    description: `**${opportunity.marketA.title}**`,
    color,
    fields: [
      {
        name: '💰 Expected Profit',
        value: `$${profitAmount} (${profitPercent}%)`,
        inline: true,
      },
      {
        name: '⏰ Market Closes',
        value: endDate,
        inline: true,
      },
      {
        name: '\u200B', // Empty field for spacing
        value: '\u200B',
        inline: false,
      },
      {
        name: `📊 ${opportunity.marketA.platform}`,
        value: [
          `**${opportunity.outcomeA}:** $${opportunity.marketA.outcomes.find(o => o.name === opportunity.outcomeA)?.price.toFixed(2)}`,
          `**${opportunity.outcomeB}:** $${opportunity.marketB.outcomes.find(o => o.name === opportunity.outcomeB)?.price.toFixed(2)}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: `📊 ${opportunity.marketB.platform}`,
        value: [
          `**${opportunity.outcomeA}:** $${opportunity.marketB.outcomes.find(o => o.name === opportunity.outcomeA)?.price.toFixed(2)}`,
          `**${opportunity.outcomeB}:** $${opportunity.marketB.outcomes.find(o => o.name === opportunity.outcomeB)?.price.toFixed(2)}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '\u200B',
        value: '\u200B',
        inline: false,
      },
      {
        name: '🔗 Links',
        value: [
          opportunity.marketA.url ? `[${opportunity.marketA.platform}](${opportunity.marketA.url})` : opportunity.marketA.platform,
          opportunity.marketB.url ? `[${opportunity.marketB.platform}](${opportunity.marketB.url})` : opportunity.marketB.platform,
        ].join(' • '),
        inline: false,
      },
    ],
    footer: {
      text: 'Arbitrage Scanner • Act fast, prices change quickly!',
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Send alert to Discord webhook
 */
async function sendToDiscord(embed: DiscordEmbed): Promise<void> {
  const webhookUrl = CONFIG.alerts.discordWebhook;
  
  if (!webhookUrl) {
    throw new Error('Discord webhook URL not configured. Set DISCORD_WEBHOOK_URL environment variable.');
  }

  const payload: DiscordWebhookPayload = {
    username: 'Arbitrage Scanner',
    embeds: [embed],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord webhook failed (${response.status}): ${errorText}`);
    }

    logger.debug('Successfully sent Discord alert');
  } catch (error) {
    logger.error('Failed to send Discord alert:', error);
    throw error;
  }
}

/**
 * Send alert for an arbitrage opportunity
 */
export async function sendArbitrageAlert(opportunity: ArbitrageOpportunity): Promise<void> {
  try {
    // Check if alerts are enabled
    if (!CONFIG.alerts.enabled) {
      logger.debug('Alerts disabled, skipping');
      return;
    }

    // Check cooldown
    if (await isInCooldown(opportunity)) {
      logger.debug(`Alert cooldown active for ${opportunity.marketA.id} vs ${opportunity.marketB.id}`);
      return;
    }

    // Format and send
    const embed = formatDiscordEmbed(opportunity);
    await sendToDiscord(embed);
    
    // Mark as alerted
    await markAlerted(opportunity);
    
    logger.success(`Alert sent for opportunity: $${opportunity.profitMargin.toFixed(2)} profit`);
  } catch (error) {
    logger.error('Failed to send alert:', error);
    // Don't throw - alert failure shouldn't break the scan
  }
}

/**
 * Send alerts for multiple opportunities
 */
export async function sendAlerts(opportunities: ArbitrageOpportunity[]): Promise<void> {
  if (opportunities.length === 0) {
    return;
  }

  logger.info(`Sending alerts for ${opportunities.length} opportunities...`);

  // Send alerts sequentially to respect rate limits
  // Discord allows 30 requests/min, so we wait 2 seconds between each
  for (const opportunity of opportunities) {
    await sendArbitrageAlert(opportunity);
    
    // Rate limiting: 2 seconds between alerts (max 30/min)
    if (opportunities.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Send a test alert to verify webhook configuration
 */
export async function sendTestAlert(): Promise<void> {
  const testEmbed: DiscordEmbed = {
    title: '✅ Test Alert',
    description: 'Alert system is configured correctly!',
    color: 0x00ff00,
    fields: [
      {
        name: 'Status',
        value: 'All systems operational',
        inline: false,
      },
    ],
    footer: {
      text: 'Arbitrage Scanner',
    },
    timestamp: new Date().toISOString(),
  };

  await sendToDiscord(testEmbed);
  logger.success('Test alert sent successfully!');
}
