# 🚀 Real-Time Scanner Setup Guide

## Prerequisites

You need **Redis** running locally or remotely.

---

## Option 1: Docker (Easiest) ✅

**Install Docker Desktop:**
- Windows: https://www.docker.com/products/docker-desktop

**Run Redis:**
```powershell
docker run -d --name redis-arb-scanner -p 6379:6379 redis
```

**Verify it's running:**
```powershell
docker ps
```

**Stop Redis:**
```powershell
docker stop redis-arb-scanner
```

**Start Redis again:**
```powershell
docker start redis-arb-scanner
```

---

## Option 2: Windows Native

**Install Redis for Windows:**
```powershell
# Using Chocolatey
choco install redis-64

# Or download MSI from:
# https://github.com/microsoftarchive/redis/releases
```

**Start Redis:**
```powershell
redis-server
```

---

## Option 3: Cloud Redis (Production)

**Free Options:**
- **Redis Cloud**: https://redis.com/try-free/ (30MB free)
- **Upstash**: https://upstash.com/ (10k commands/day free)

**Set environment variables:**
```powershell
# PowerShell
$env:REDIS_HOST="your-redis-host.com"
$env:REDIS_PORT="6379"
$env:REDIS_PASSWORD="your-password"
```

---

## Testing the Setup

### 1. Test Redis Connection

```powershell
npm run test:queue
```

**Expected output:**
```
🧪 TESTING JOB QUEUE SYSTEM
══════════════════════════════════════════

✅ Connected to Redis

📝 Test 1: Cache Operations
─────────────────────────────────────────
✅ Set and get: { hello: 'world' }
✅ Exists check: true
✅ After delete: null

📝 Test 2: Queue Stats (before jobs)
─────────────────────────────────────────
Stats: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0 }

📝 Test 3: Add Single Scan Job
─────────────────────────────────────────
✅ Job added: scan-1234567890
   Platform A: POLYMARKET
   Platform B: MANIFOLD
   Limit: 10

📝 Test 4: Process Job with Worker
─────────────────────────────────────────
Starting worker...
Waiting for job to complete...

✅ Job completed!
   Job ID: scan-1234567890
   Duration: 1234ms
   Markets scanned: {"POLYMARKET":10,"MANIFOLD":10}
   Matches found: 0
   Opportunities: 0
```

### 2. Start Real-Time Scanner

```powershell
npm run scan:realtime
```

**Expected output:**
```
🔄 REAL-TIME ARBITRAGE SCANNER
══════════════════════════════════════════

ℹ️  Starting background worker...
✅ Worker started and ready to process jobs
ℹ️  Setting up recurring scans...
✅ Recurring scans configured

✅ Scanner is now running!
───────────────────────────────
📊 Scan Frequency: Every 60 seconds
🔍 Markets: PolyMarket (200) vs Manifold (200)
💾 Caching: Enabled (2 min TTL)
📈 Results: Stored for 1 hour

ℹ️  Scanner running. Press Ctrl+C to stop.

📊 SCANNER STATUS
─────────────────────────────────────────
⏳ Jobs in queue: 0
⚡ Jobs active: 1
✅ Jobs completed: 5
❌ Jobs failed: 0
💾 Cached keys: 12
🧠 Memory used: 2.5M
🕐 2:30:45 PM
```

**The scanner will now:**
1. ✅ Run every 60 seconds automatically
2. ✅ Cache market data (2 min TTL)
3. ✅ Store results (1 hour TTL)
4. ✅ Show live status every 30 seconds
5. ✅ Process jobs in background

---

## Troubleshooting

### Error: "Redis connection error: connect ECONNREFUSED"

**Solution:** Redis is not running.
```powershell
# If using Docker
docker start redis-arb-scanner

# If using native Redis
redis-server
```

### Error: "Module not found: ioredis"

**Solution:** Install dependencies.
```powershell
npm install
```

### Jobs not processing

**Check worker status:**
```powershell
# In Redis CLI
redis-cli

# List all keys
KEYS *

# Check queue
LLEN bull:arbitrage-scan:waiting
LLEN bull:arbitrage-scan:active
```

---

## How It Works

### Architecture

```
┌─────────────────────────────────────────┐
│  Scheduler (src/scheduler.ts)           │
│  - Adds recurring jobs every 60s        │
│  - Monitors queue status                │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  Redis (Message Queue + Cache)          │
│  - Stores pending jobs                  │
│  - Caches market data (2 min)           │
│  - Stores results (1 hour)              │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  Worker (src/services/queue.ts)         │
│  - Processes jobs from queue            │
│  - Fetches markets (with cache)         │
│  - Runs matching + calculation          │
│  - Stores results                       │
└─────────────────────────────────────────┘
```

### Job Flow

```
1. Scheduler adds job every 60s
   ↓
2. Job enters Redis queue
   ↓
3. Worker picks up job
   ↓
4. Worker checks cache for markets
   ↓
5. If cache miss → fetch from API
   ↓
6. Run matching algorithm
   ↓
7. Calculate arbitrage opportunities
   ↓
8. Store results in cache
   ↓
9. Job completes
```

### Caching Strategy

| Data | TTL | Reason |
|------|-----|--------|
| Markets | 2 min | Prices change slowly |
| Opportunities | 2 min | Show latest results |
| Scan results | 1 hour | Historical tracking |

---

## Configuration

**Environment Variables:**
```powershell
# Redis connection
$env:REDIS_HOST="localhost"
$env:REDIS_PORT="6379"
$env:REDIS_PASSWORD=""  # Optional
```

**Adjust scan frequency:**
Edit `src/scheduler.ts`:
```typescript
await addRecurringScanJob({
  platformA: 'POLYMARKET',
  platformB: 'MANIFOLD',
  limit: 200,
}, 60); // ← Change this number (seconds)
```

**Adjust cache TTL:**
Edit `src/services/queue.ts`:
```typescript
await Cache.set(cacheKey, markets, 120); // ← Change this (seconds)
```

---

## Next Steps

Current follow-up work:
1. ✅ Discord alert delivery is integrated
2. ⏳ Add a web dashboard to view results
3. ⏳ Add more platform adapters
4. ⏳ Store historical results in a database

---

**Questions?** Check the code or ask for help!
