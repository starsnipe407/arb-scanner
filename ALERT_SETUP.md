# Alert System - Setup Instructions

## 🎯 Quick Start

### 1. Create Discord Webhook

1. Open your Discord server
2. Go to **Server Settings** → **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Choose a channel for alerts (e.g., #arbitrage-alerts)
5. Copy the **Webhook URL**

### 2. Configure Environment Variables

Create or update your `.env` file in the project root:

```bash
# Discord Alert Configuration
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL_HERE

# Alert Thresholds (optional - defaults shown)
ALERTS_ENABLED=true
ALERT_MIN_PROFIT_PERCENT=5      # Minimum 5% ROI to trigger alert
ALERT_MIN_PROFIT_AMOUNT=10      # Minimum $10 profit to trigger alert
ALERT_COOLDOWN_MINUTES=10       # Don't re-alert same opportunity for 10 minutes
```

### 3. Test the Alert System

```bash
npm run test:alerts
```

This will:
- ✅ Verify your webhook configuration
- ✅ Send a test alert to Discord
- ✅ Send a mock arbitrage opportunity alert
- ✅ Test cooldown deduplication

### 4. Run Real-Time Scanner with Alerts

```bash
npm run scan:realtime
```

Alerts will automatically be sent when profitable opportunities are found!

---

## 📊 How It Works

### Alert Flow

```
Scanner finds opportunities
         ↓
Filter by thresholds (min profit %, min profit $)
         ↓
Check cooldown (prevent duplicate alerts)
         ↓
Format as Discord embed
         ↓
Send to webhook (with rate limiting)
         ↓
Mark as alerted (set cooldown)
```

### Alert Thresholds

**Minimum Profit Percentage:**
- Default: 5%
- Only alerts if ROI ≥ this threshold
- Filters out tiny arbitrage opportunities

**Minimum Profit Amount:**
- Default: $10
- Only alerts if profit margin ≥ this threshold
- Prevents spam for insignificant gains

**Cooldown Period:**
- Default: 10 minutes
- Prevents re-alerting the same market pair
- Uses Redis cache with TTL

### Rate Limiting

- Discord webhooks: 30 requests/minute max
- We send 1 alert per 2 seconds (max 30/min)
- Multiple opportunities are sent sequentially with delays

---

## 🎨 Alert Format

Discord alerts include:

- **Market Question** - The event being predicted
- **Expected Profit** - Dollar amount and percentage
- **Market Close Time** - When the opportunity expires
- **Price Breakdown** - Prices on both platforms
- **Direct Links** - Click to view markets
- **Color Coding** - Green = profitable

---

## 🔧 Configuration Options

### Disable Alerts Temporarily

```bash
ALERTS_ENABLED=false npm run scan:realtime
```

### Adjust Thresholds

For high-value opportunities only:
```bash
ALERT_MIN_PROFIT_PERCENT=10
ALERT_MIN_PROFIT_AMOUNT=50
```

For all opportunities:
```bash
ALERT_MIN_PROFIT_PERCENT=0
ALERT_MIN_PROFIT_AMOUNT=0
```

---

## 🧪 Testing

### Test Basic Alert
```bash
npm run test:alerts
```

### Test with Real Scanner
```bash
# 1. Clear Redis first
npm run clear:redis

# 2. Run scanner
npm run scan:realtime
```

Check your Discord channel for alerts!

---

## ⚠️ Troubleshooting

### No Alerts Received

1. **Check webhook URL** - Make sure `DISCORD_WEBHOOK_URL` is set correctly
2. **Check thresholds** - Opportunities might not meet minimum profit requirements
3. **Check cooldown** - Same opportunity won't alert twice within cooldown period
4. **Check Discord channel** - Verify webhook is posting to the correct channel

### Too Many Alerts

Increase thresholds:
```bash
ALERT_MIN_PROFIT_PERCENT=10
ALERT_MIN_PROFIT_AMOUNT=25
ALERT_COOLDOWN_MINUTES=30
```

### Webhook Errors

- **401 Unauthorized** - Invalid webhook URL
- **404 Not Found** - Webhook deleted or URL incorrect
- **429 Rate Limited** - Too many requests (we handle this automatically)

---

## 📈 Next Steps

**Completed:** ✅ Discord Alert System

**Next Features:**
1. **Web Dashboard** - Visual interface with charts
2. **Telegram Support** - Alternative to Discord
3. **Email Alerts** - Summary reports
4. **SMS Alerts** - High-priority opportunities

---

## 🔑 Security Notes

- **Never commit `.env` file** - Add to `.gitignore`
- **Keep webhook URLs private** - Anyone with URL can post to your channel
- **Rotate webhooks** - If exposed, delete and create new one
- **Use separate channels** - Don't mix alerts with other Discord activity
