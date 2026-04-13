import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit, shouldSkipRateLimit } from '@/modules/core/services/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('first request within limit returns allowed=true', () => {
    const result = checkRateLimit('test-key-1', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('remaining decreases with each request', () => {
    const key = 'test-key-2';
    const limit = 5;
    const windowMs = 60000;

    const r1 = checkRateLimit(key, limit, windowMs);
    expect(r1.remaining).toBe(4);

    const r2 = checkRateLimit(key, limit, windowMs);
    expect(r2.remaining).toBe(3);

    const r3 = checkRateLimit(key, limit, windowMs);
    expect(r3.remaining).toBe(2);
  });

  it('request exceeding limit returns allowed=false', () => {
    const key = 'test-key-3';
    const limit = 3;
    const windowMs = 60000;

    checkRateLimit(key, limit, windowMs); // 1
    checkRateLimit(key, limit, windowMs); // 2
    checkRateLimit(key, limit, windowMs); // 3

    const r4 = checkRateLimit(key, limit, windowMs);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it('counter resets after window expires', () => {
    const key = 'test-key-4';
    const limit = 2;
    const windowMs = 60000;

    checkRateLimit(key, limit, windowMs); // 1
    checkRateLimit(key, limit, windowMs); // 2

    const blocked = checkRateLimit(key, limit, windowMs);
    expect(blocked.allowed).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(61000);

    const afterReset = checkRateLimit(key, limit, windowMs);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(1);
  });

  it('different keys are tracked independently', () => {
    checkRateLimit('key-a', 1, 60000);
    const blockedA = checkRateLimit('key-a', 1, 60000);
    expect(blockedA.allowed).toBe(false);

    const allowedB = checkRateLimit('key-b', 1, 60000);
    expect(allowedB.allowed).toBe(true);
  });
});

describe('shouldSkipRateLimit', () => {
  it('/api/health returns true (should skip)', () => {
    expect(shouldSkipRateLimit('/api/health')).toBe(true);
  });

  it('/api/products returns false (should not skip)', () => {
    expect(shouldSkipRateLimit('/api/products')).toBe(false);
  });

  it('/api/auth/login returns false', () => {
    expect(shouldSkipRateLimit('/api/auth/login')).toBe(false);
  });
});
