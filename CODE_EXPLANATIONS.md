# 📚 Code Explanations - Error Handling & Rate Limiting

This document explains the three core utility files added for robust error handling and rate limiting.

---

## 1. 🚦 rateLimiter.ts - Preventing API Bans

### Problem
When scanning 200+ markets, your code makes hundreds of API requests in seconds. APIs will ban you for "abuse". You need to control request frequency.

### Solution: Bottleneck Library

```typescript
import Bottleneck from 'bottleneck';
```

Think of it like a bouncer at a club - controls how many people (requests) enter and how fast.

### Configuration Example: PolyMarket

```typescript
export const polyMarketLimiter = new Bottleneck({
  maxConcurrent: 5,              // Max 5 requests running simultaneously
  minTime: 100,                  // Wait 100ms between each request (10 req/sec)
  reservoir: 50,                 // Start with 50 "tokens"
  reservoirRefreshAmount: 50,    // Every 5 seconds...
  reservoirRefreshInterval: 5000 // ...add 50 tokens back
});
```

**Real-World Analogy:**
- `maxConcurrent: 5` → Only 5 people can be in the store at once
- `minTime: 100` → Each person waits 100ms before entering (10 people/sec)
- `reservoir: 50` → You have 50 "tickets" to use
- `reservoirRefreshInterval: 5000` → Every 5 seconds, get 50 new tickets

### Why Different Limits?

| Platform | Rate | Reasoning |
|----------|------|-----------|
| PolyMarket | 10 req/sec | Real money platform - stricter limits |
| Manifold | 5 req/sec | Play money - be extra nice |
| Kalshi | 2 req/sec | Real money + known to be strict |

### Event Logging

```typescript
polyMarketLimiter.on('depleted', () => {
  logger.warn('PolyMarket rate limit depleted, waiting for refill...');
});

polyMarketLimiter.on('queued', () => {
  logger.debug('Request queued - PolyMarket rate limit active');
});
```

**Purpose:** 
- `depleted` - Warns when you run out of tokens
- `queued` - Logs when requests are delayed (helps debug slow performance)

### Usage in Code

```typescript
// Before: Direct API call (can overwhelm server)
const response = await axios.get('/markets');

// After: Rate-limited API call
const response = await polyMarketLimiter.schedule(async () => {
  return await axios.get('/markets');
});
```

Every API call gets automatically queued and throttled.

---

## 2. 🎯 errors.ts - Smart Error Handling

### Problem
When an API call fails, you need to know:
1. **What** went wrong? (network error? bad data? rate limit?)
2. **Should I retry?** (yes for 503 server error, no for 404 not found)
3. **How long to wait** before retrying? (1 min for rate limits, 5s for server errors)

Generic `Error` objects can't answer these questions. You need **typed errors**.

---

### Base: ScannerError

```typescript
export class ScannerError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ScannerError';
    Error.captureStackTrace(this, this.constructor);
  }
}
```

**Features:**
- All scanner errors extend this
- `cause?: unknown` - Stores original error for debugging
- `Error.captureStackTrace` - Provides proper stack traces

---

### APIError - Network/HTTP Failures

```typescript
export class APIError extends ScannerError {
  constructor(
    message: string,
    public readonly platform: string,      // Which API failed?
    public readonly statusCode?: number,   // HTTP status (404, 503, etc.)
    cause?: unknown
  ) {
    super(message, cause);
    this.name = 'APIError';
  }
```

#### The Magic: isRetryable()

```typescript
isRetryable(): boolean {
  if (!this.statusCode) return true;        // Network error → RETRY
  if (this.statusCode >= 500) return true;  // Server error (5xx) → RETRY
  if (this.statusCode === 429) return true; // Rate limit → RETRY
  return false;                             // Client error (4xx) → DON'T RETRY
}
```

**Logic:**
- `404 Not Found` - YOUR mistake, don't waste time retrying
- `503 Service Unavailable` - THEIR server down, retry makes sense
- `429 Rate Limited` - Wait and retry
- `Network timeout` - Temporary issue, retry

#### Smart Retry Delays

```typescript
getRetryDelay(): number {
  if (this.statusCode === 429) return 60000;  // Rate limit: wait 1 minute
  if (this.statusCode >= 500) return 5000;    // Server error: wait 5 seconds
  return 2000;                                 // Default: 2 seconds
}
```

**Why This Matters:**
- Rate limits need longer waits (respect the API)
- Server errors need moderate waits (give it time to recover)
- Network glitches need quick retries (might work immediately)

---

### ValidationError - Bad Data

```typescript
export class ValidationError extends ScannerError {
  constructor(
    message: string,
    public readonly data: unknown,  // Store bad data for debugging
    cause?: unknown
  ) {
    super(message, cause);
    this.name = 'ValidationError';
  }
}
```

**When Used:**
```typescript
// API returns unexpected format
try {
  const validatedData = PolyMarketResponseSchema.parse(response.data);
} catch (zodError) {
  // Throw ValidationError with the bad data attached
  throw new ValidationError('Invalid format', response.data, zodError);
}
```

**Benefit:** You can inspect the bad data to fix schema or report API bug.

---

### RateLimitError - Special Case

```typescript
export class RateLimitError extends APIError {
  constructor(
    message: string,
    platform: string,
    public readonly retryAfter?: number,  // Server says "retry after X seconds"
    cause?: unknown
  ) {
    super(message, platform, 429, cause);
    this.name = 'RateLimitError';
  }

  getRetryDelay(): number {
    // Respect server's instruction if provided
    return this.retryAfter ? this.retryAfter * 1000 : 60000;
  }
}
```

**Why Separate Class?**
- Rate limits often include `Retry-After` header
- You want to respect the server's exact instruction, not guess

---

### classifyError() - The Error Detective

```typescript
export function classifyError(error: unknown, platform: string): ScannerError
```

**Problem:** Axios throws generic errors. Zod throws generic errors. You need typed errors.

**Solution:** Automatically detect and classify:

```typescript
// 1. Check if it's an Axios error
if (error && typeof error === 'object' && 'isAxiosError' in error) {
  const axiosError = error as any;
  
  // Rate limit (429)
  if (axiosError.response?.status === 429) {
    const retryAfter = axiosError.response?.headers['retry-after'];
    return new RateLimitError('Rate limit exceeded', platform, retryAfter, error);
  }
  
  // Network timeout
  if (axiosError.code === 'ETIMEDOUT') {
    return new APIError('Request timeout', platform, undefined, error);
  }
  
  // HTTP error (404, 500, etc.)
  if (axiosError.response) {
    return new APIError(
      `API failed: ${axiosError.response.status}`,
      platform,
      axiosError.response.status,
      error
    );
  }
}

// 2. Check if it's a Zod validation error
if (error && typeof error === 'object' && 'issues' in error) {
  return new ValidationError('Invalid data', error, error);
}

// 3. Generic error
return new ScannerError('Unknown error', error);
```

**Usage:**
```typescript
try {
  await axios.get('/markets');
} catch (error) {
  // Convert to typed error
  const typedError = classifyError(error, 'PolyMarket');
  
  // Now you can make smart decisions
  if (typedError instanceof APIError && typedError.isRetryable()) {
    await sleep(typedError.getRetryDelay());
    // retry...
  }
}
```

---

## 3. 🛠️ helpers.ts - Utility Functions

### Problem
You use the same operations everywhere (validation, retries, formatting). Without helpers, you copy-paste code → bugs and inconsistency.

---

### isValidMarket() - Data Validation

```typescript
export function isValidMarket(market: StandardMarket): boolean {
  return (
    market.id.length > 0 &&                    // Must have ID
    market.title.length > 0 &&                 // Must have title
    market.outcomes.length >= 2 &&             // At least 2 outcomes (binary)
    market.outcomes.every(o => 
      o.price.greaterThanOrEqualTo(0) &&      // Price can't be negative
      o.price.lessThanOrEqualTo(1)            // Price can't exceed $1.00
    )
  );
}
```

**Why Needed:**
APIs sometimes return garbage data (missing IDs, negative prices, etc.).

**Usage:**
```typescript
const markets = await polymarket.fetchMarkets();
const validMarkets = markets.filter(isValidMarket);  // Filter out junk
```

---

### retryWithBackoff() - Exponential Backoff

#### The Options

```typescript
export interface RetryOptions {
  maxRetries?: number;              // Max attempts (default: 3)
  initialDelay?: number;            // Starting delay (default: 1000ms)
  maxDelay?: number;                // Cap delay at this (default: 10000ms)
  shouldRetry?: (error: unknown) => boolean;  // Custom retry logic
}
```

#### The Implementation

```typescript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000, shouldRetry = () => true } = options;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();  // Try the operation
    } catch (error) {
      // Last attempt? Give up
      if (i === maxRetries - 1) throw error;
      
      // Custom logic says don't retry? Give up
      if (!shouldRetry(error)) throw error;
      
      // Calculate delay: 1s → 2s → 4s → 8s (exponential, capped at 10s)
      const delay = Math.min(initialDelay * Math.pow(2, i), maxDelay);
      await sleep(delay);
    }
  }
}
```

#### Why Exponential Backoff?

**Timeline:**
```
Attempt 1: Fails → Wait 1 second  → Retry
Attempt 2: Fails → Wait 2 seconds → Retry
Attempt 3: Fails → Wait 4 seconds → Retry
Attempt 4: Fails → Wait 8 seconds → Give up
```

**Reasoning:**
- If server is overloaded, waiting **longer** gives it time to recover
- Quick retries would just hammer an already-struggling server
- Industry standard for distributed systems

#### Real Usage

```typescript
// Fetch with smart retry
return retryWithBackoff(operation, {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  shouldRetry: (error) => {
    // Only retry temporary errors (not 404s)
    return error instanceof APIError && error.isRetryable();
  }
});
```

**Before:**
```typescript
// Retry everything blindly, same delay each time
for (let i = 0; i < 3; i++) {
  try {
    return await fetchData();
  } catch {
    await sleep(1000);  // Always 1 second
  }
}
```

**After:**
```typescript
// Smart retry with conditional logic and exponential backoff
return retryWithBackoff(fetchData, {
  shouldRetry: (error) => error.isRetryable()  // Don't retry 404s
});
```

---

### Other Utility Functions

```typescript
// Date math
daysDifference(date1, date2)  // Used by matcher to filter markets by date range

// String cleanup
sanitizeTitle(title)          // Removes special chars for fuzzy matching
                              // "Will Trump win? 🇺🇸" → "will trump win"

// Formatting
formatPercent(0.1234)         // → "12.34%"
formatCurrency(42.567)        // → "$42.57"

// Async utilities
sleep(1000)                   // Wait 1 second (Promise-based)
```

---

## 🔗 How They Work Together

### Example: Full Protected API Call

```typescript
// 1. Rate limiter queues request if quota exceeded
await polyMarketLimiter.schedule(async () => {
  
  // 2. Make API call
  const response = await axios.get('/markets');
  
  // 3. Validate response (throws ValidationError if invalid)
  const data = PolyMarketResponseSchema.parse(response.data);
  
  return data;
});
```

If error occurs:
```typescript
try {
  // API call
} catch (error) {
  // 4. Classify the error
  const typedError = classifyError(error, 'PolyMarket');
  
  // 5. If retryable (5xx, 429, timeout), retry with exponential backoff
  if (typedError instanceof APIError && typedError.isRetryable()) {
    const delay = typedError.getRetryDelay();
    await sleep(delay);
    // retry...
  }
  
  // 6. If not retryable (4xx), fail immediately
  throw typedError;
}
```

### Error Flow Diagram

```
API Call
  ↓
Error Occurs
  ↓
classifyError() → Detects error type
  ↓
APIError? → isRetryable()?
  ↓              ↓
  NO            YES
  ↓              ↓
Fail          getRetryDelay() → Wait → retryWithBackoff()
                ↓
              Try again (exponentially slower)
```

---

## ✨ Key Takeaways

### rateLimiter.ts
- **Purpose:** Prevent API bans by throttling requests
- **How:** Bottleneck library with token bucket algorithm
- **Benefit:** Can scan 200+ markets without getting banned

### errors.ts
- **Purpose:** Know what went wrong and how to fix it
- **How:** Typed error classes with retry logic
- **Benefit:** Only retry when it makes sense, fail fast otherwise

### helpers.ts
- **Purpose:** Reusable utilities to avoid code duplication
- **How:** Pure functions for validation, formatting, retry logic
- **Benefit:** Consistent behavior across entire codebase

---

## 📖 Additional Resources

**Test Files** (now in [src/tests/](src/tests/)):
- `test-error-handling.ts` - Demonstrates all error handling features
- `test-matcher.ts` - Shows fuzzy matching in action
- `test-calculator.ts` - Arbitrage calculation examples
- `demo-scanner.ts` - End-to-end demo with simulated data

**Run Tests:**
```bash
npm run test:errors      # Test error handling
npm run test:matcher     # Test market matching
npm run test:calculator  # Test arbitrage calculator
npm run demo             # Run full demo
```

---

**Questions?** Ask about any specific part of the code!
