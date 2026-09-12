import assert from 'node:assert/strict';

process.env.POLYMARKET_API_URL = 'https://example.com/polymarket';
process.env.MANIFOLD_API_URL = 'https://example.com/manifold';
process.env.KALSHI_API_URL = 'https://example.com/kalshi';
process.env.ALERTS_ENABLED = 'true';
delete process.env.DISCORD_WEBHOOK_URL;

const { CONFIG } = await import('../config.js');

assert.equal(CONFIG.api.polymarket.baseUrl, 'https://example.com/polymarket');
assert.equal(CONFIG.api.manifold.baseUrl, 'https://example.com/manifold');
assert.equal(CONFIG.api.kalshi.baseUrl, 'https://example.com/kalshi');
assert.equal(CONFIG.alerts.enabled, false);

console.log('Configuration checks passed');
