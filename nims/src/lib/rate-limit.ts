/**
 * In-Memory Rate Limiter for Authentication & Sensitive Operations
 * Uses sliding window counter per key (e.g., client IP or username).
 */

interface RateLimitRecord {
  attempts: number[]; // Timestamps of failed attempts
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetTime: Date;
}

/**
 * Check if the key is currently rate limited
 */
export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record) {
    return {
      allowed: true,
      remaining: maxAttempts,
      retryAfterSeconds: 0,
      resetTime: new Date(now + windowMs),
    };
  }

  // Filter out attempts older than windowMs
  const validAttempts = record.attempts.filter((ts) => now - ts < windowMs);
  record.attempts = validAttempts;

  if (validAttempts.length >= maxAttempts) {
    const oldest = validAttempts[0];
    const retryAfterMs = oldest + windowMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
      resetTime: new Date(oldest + windowMs),
    };
  }

  return {
    allowed: true,
    remaining: maxAttempts - validAttempts.length,
    retryAfterSeconds: 0,
    resetTime: new Date(now + windowMs),
  };
}

/**
 * Record a failed attempt
 */
export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record) {
    rateLimitStore.set(key, { attempts: [now] });
  } else {
    record.attempts.push(now);
  }
}

/**
 * Reset rate limit record on successful authentication
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}
