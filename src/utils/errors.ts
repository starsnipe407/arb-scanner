/**
 * Custom Error Classes
 * 
 * Specific error types for better error handling and recovery
 */

/**
 * Base error class for all scanner errors
 */
export class ScannerError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ScannerError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * API-related errors (network, timeout, rate limit)
 */
export class APIError extends ScannerError {
  constructor(
    message: string,
    public readonly platform: string,
    public readonly statusCode?: number,
    cause?: unknown
  ) {
    super(message, cause);
    this.name = 'APIError';
  }

  /**
   * Check if error is retryable (temporary failures)
   */
  isRetryable(): boolean {
    // Retry on network errors, timeouts, and server errors (5xx)
    if (!this.statusCode) return true; // Network/timeout errors
    if (this.statusCode >= 500) return true; // Server errors
    if (this.statusCode === 429) return true; // Rate limit
    return false;
  }

  /**
   * Get suggested retry delay in milliseconds
   */
  getRetryDelay(): number {
    if (this.statusCode === 429) return 60000; // Rate limit: wait 1 minute
    if (this.statusCode && this.statusCode >= 500) return 5000; // Server error: wait 5s
    return 2000; // Default: 2s
  }
}

/**
 * Data validation errors (invalid/malformed API responses)
 */
export class ValidationError extends ScannerError {
  constructor(
    message: string,
    public readonly data: unknown,
    cause?: unknown
  ) {
    super(message, cause);
    this.name = 'ValidationError';
  }
}

/**
 * Configuration errors (missing env vars, invalid config)
 */
export class ConfigError extends ScannerError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'ConfigError';
  }
}

/**
 * Rate limit errors (exceeded API quota)
 */
export class RateLimitError extends APIError {
  constructor(
    message: string,
    platform: string,
    public readonly retryAfter?: number, // seconds
    cause?: unknown
  ) {
    super(message, platform, 429, cause);
    this.name = 'RateLimitError';
  }

  getRetryDelay(): number {
    return this.retryAfter ? this.retryAfter * 1000 : 60000;
  }
}

/**
 * Helper to determine error type from axios error
 */
export function classifyError(error: unknown, platform: string): ScannerError {
  // Axios errors
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as any;
    
    // Rate limit
    if (axiosError.response?.status === 429) {
      const retryAfter = axiosError.response?.headers['retry-after'];
      return new RateLimitError(
        `Rate limit exceeded for ${platform}`,
        platform,
        retryAfter ? parseInt(retryAfter) : undefined,
        error
      );
    }

    // Other HTTP errors
    if (axiosError.response) {
      return new APIError(
        `API request failed: ${axiosError.response.status} ${axiosError.response.statusText}`,
        platform,
        axiosError.response.status,
        error
      );
    }

    // Network/timeout errors
    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return new APIError(
        `Request timeout for ${platform}`,
        platform,
        undefined,
        error
      );
    }

    // Other network errors
    return new APIError(
      `Network error: ${axiosError.message}`,
      platform,
      undefined,
      error
    );
  }

  // Zod validation errors
  if (error && typeof error === 'object' && 'issues' in error) {
    return new ValidationError(
      `Invalid data from ${platform}`,
      error,
      error
    );
  }

  // Generic scanner error
  if (error instanceof Error) {
    return new ScannerError(error.message, error);
  }

  // Unknown error
  return new ScannerError('Unknown error occurred', error);
}
