import { NextRequest } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyGenerator: (req: NextRequest) => string;
}

/**
 * Check rate limit for a given key.
 * Returns whether the request is allowed, remaining quota, and reset time.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt: new Date(resetAt) };
  }

  record.count++;
  const allowed = record.count <= limit;
  const remaining = Math.max(0, limit - record.count);

  return { allowed, remaining, resetAt: new Date(record.resetAt) };
}

// Shared in-memory store
const store = new Map<string, RateLimitRecord>();

// Periodic cleanup: remove expired entries every 60 seconds
const CLEANUP_INTERVAL_MS = 60_000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
  if (cleanupTimer !== null) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    store.forEach((record, key) => {
      if (now > record.resetAt) {
        store.delete(key);
      }
    });
  }, CLEANUP_INTERVAL_MS);
  // Unref so the timer doesn't prevent Node.js from exiting
  if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

ensureCleanup();

/**
 * Creates a rate limiter middleware function.
 * Returns a function that checks the rate limit for a request and returns
 * the result (allowed, remaining, resetAt).
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, keyGenerator } = options;

  return function rateLimit(req: NextRequest): RateLimitResult {
    const key = keyGenerator(req);
    return checkRateLimit(key, max, windowMs);
  };
}

/**
 * Extract client IP from request headers.
 */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Global rate limiter: 100 requests per minute per IP.
 */
export const globalRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 100,
  keyGenerator: (req) => `global:${getClientIp(req)}`,
});

/**
 * User-level rate limiter: 300 requests per minute per user.
 * Expects x-user-id header or falls back to IP.
 */
export const userRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 300,
  keyGenerator: (req) => {
    const userId = req.headers.get('x-user-id');
    return userId ? `user:${userId}` : `user-ip:${getClientIp(req)}`;
  },
});

/**
 * Check if a request path should skip rate limiting.
 */
export function shouldSkipRateLimit(pathname: string): boolean {
  return pathname === '/api/health';
}
