import { describe, it, expect, vi } from 'vitest';

// Mock supabase to avoid top-level createClient requiring env vars
vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => ({ data: null, error: null })),
    })),
  })),
  supabase: {},
}));

vi.mock('@/modules/core/services/supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => ({ data: null, error: null })),
    })),
  })),
  supabase: {},
}));

import {
  numberToWordsFR,
  numberToWordsAR,
} from '@/modules/accounting/services/export-service';

describe('numberToWordsFR edge cases', () => {
  it('negative number uses absolute value', () => {
    const result = numberToWordsFR(-100);
    expect(result).toBe('cent dirhams');
  });

  it('very large number: 5000000', () => {
    const result = numberToWordsFR(5000000);
    expect(result).toContain('cinq millions');
    expect(result).toContain('dirham');
  });

  it('number with both millions and thousands: 1234567', () => {
    const result = numberToWordsFR(1234567);
    expect(result).toContain('un million');
    expect(result).toContain('mille');
    expect(result).toContain('dirham');
  });

  it('0.99 outputs zero dirhams and 99 centimes', () => {
    const result = numberToWordsFR(0.99);
    expect(result).toContain('zero');
    expect(result).toContain('centime');
  });

  it('fractional centimes: 10.5 rounds correctly', () => {
    const result = numberToWordsFR(10.5);
    expect(result).toContain('dix dirhams');
    expect(result).toContain('cinquante centime');
  });

  it('999 outputs correctly', () => {
    const result = numberToWordsFR(999);
    expect(result).toContain('neuf cent');
    expect(result).toContain('dirham');
  });

  it('17 outputs dix-sept dirham', () => {
    const result = numberToWordsFR(17);
    expect(result).toContain('dix-sept');
  });

  it('90 outputs quatre-vingt-dix', () => {
    const result = numberToWordsFR(90);
    expect(result).toContain('quatre-vingt-dix');
  });
});

describe('numberToWordsAR basic cases', () => {
  it('0 returns "sifr dirham"', () => {
    const result = numberToWordsAR(0);
    expect(result).toBe('\u0635\u0641\u0631 \u062f\u0631\u0647\u0645');
  });

  it('1 returns "wahid dirham"', () => {
    const result = numberToWordsAR(1);
    expect(result).toContain('\u0648\u0627\u062d\u062f');
  });

  it('2000 returns "alfan dirham"', () => {
    const result = numberToWordsAR(2000);
    expect(result).toContain('\u0623\u0644\u0641\u0627\u0646'); // ألفان
  });

  it('1000000 returns "milyun dirham"', () => {
    const result = numberToWordsAR(1000000);
    expect(result).toContain('\u0645\u0644\u064a\u0648\u0646'); // مليون
  });

  it('200 returns "mi-atan" (مائتان)', () => {
    const result = numberToWordsAR(200);
    expect(result).toContain('\u0645\u0627\u0626\u062a\u0627\u0646');
  });

  it('handles negative numbers gracefully', () => {
    const result = numberToWordsAR(-50);
    expect(result).toContain('\u062f\u0631\u0647\u0645');
  });
});
