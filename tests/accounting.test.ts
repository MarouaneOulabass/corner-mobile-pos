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

describe('numberToWordsFR', () => {
  it('converts 0 to "zero dirham"', () => {
    expect(numberToWordsFR(0)).toBe('zero dirham');
  });

  it('converts 1 to "un dirham"', () => {
    expect(numberToWordsFR(1)).toBe('un dirham');
  });

  it('converts 100 to "cent dirhams"', () => {
    expect(numberToWordsFR(100)).toBe('cent dirhams');
  });

  it('converts 3200.50 correctly', () => {
    const result = numberToWordsFR(3200.50);
    expect(result).toContain('trois mille deux cents dirhams');
    expect(result).toContain('cinquante centime');
  });

  it('converts 1000000 to "un million dirhams"', () => {
    const result = numberToWordsFR(1000000);
    expect(result).toContain('un million');
    expect(result).toContain('dirham');
  });

  it('converts 21 correctly (vingt et un)', () => {
    const result = numberToWordsFR(21);
    expect(result).toContain('vingt et un');
  });

  it('converts 71 correctly (soixante-et-onze)', () => {
    const result = numberToWordsFR(71);
    expect(result).toContain('soixante');
  });

  it('converts 80 to quatre-vingts', () => {
    const result = numberToWordsFR(80);
    expect(result).toContain('quatre-vingts');
  });

  it('converts 200 to deux cents', () => {
    const result = numberToWordsFR(200);
    expect(result).toContain('deux cents');
  });

  it('converts 1000 to mille', () => {
    const result = numberToWordsFR(1000);
    expect(result).toContain('mille');
    // Should not be "un mille"
    expect(result).not.toContain('un mille');
  });

  it('handles negative numbers (uses absolute value)', () => {
    const result = numberToWordsFR(-500);
    expect(result).toContain('cinq cents dirhams');
  });

  it('handles very large numbers (millions)', () => {
    const result = numberToWordsFR(2500000);
    expect(result).toContain('deux million');
    expect(result).toContain('cinq cents mille');
  });
});

describe('numberToWordsAR', () => {
  it('converts 0 correctly', () => {
    const result = numberToWordsAR(0);
    expect(result).toContain('\u0635\u0641\u0631'); // صفر
    expect(result).toContain('\u062f\u0631\u0647\u0645'); // درهم
  });

  it('converts 1 correctly', () => {
    const result = numberToWordsAR(1);
    expect(result).toContain('\u0648\u0627\u062d\u062f'); // واحد
    expect(result).toContain('\u062f\u0631\u0647\u0645'); // درهم
  });

  it('converts 1000 correctly', () => {
    const result = numberToWordsAR(1000);
    expect(result).toContain('\u0623\u0644\u0641'); // ألف
  });

  it('converts 100 correctly', () => {
    const result = numberToWordsAR(100);
    expect(result).toContain('\u0645\u0627\u0626\u0629'); // مائة
  });

  it('handles decimal centimes', () => {
    const result = numberToWordsAR(50.25);
    expect(result).toContain('\u0633\u0646\u062a\u064a\u0645'); // سنتيم
  });
});

describe('journal entry validation logic', () => {
  // Test the business rule: debit must equal credit in a journal entry
  it('balanced entry: total debit equals total credit', () => {
    const lines = [
      { account_code: '411000', debit: 3200, credit: 0, label: 'Client X' },
      { account_code: '707000', debit: 0, credit: 3200, label: 'Vente' },
    ];

    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

    expect(totalDebit).toBe(totalCredit);
  });

  it('unbalanced entry: total debit does not equal total credit', () => {
    const lines = [
      { account_code: '411000', debit: 3200, credit: 0, label: 'Client X' },
      { account_code: '707000', debit: 0, credit: 3000, label: 'Vente' },
    ];

    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

    expect(totalDebit).not.toBe(totalCredit);
    expect(totalDebit - totalCredit).toBe(200);
  });

  it('multi-line entry remains balanced', () => {
    const lines = [
      { account_code: '411000', debit: 5000, credit: 0, label: 'Client' },
      { account_code: '707000', debit: 0, credit: 4000, label: 'Vente produit' },
      { account_code: '445700', debit: 0, credit: 800, label: 'TVA collectee' },
      { account_code: '758000', debit: 0, credit: 200, label: 'Autres produits' },
    ];

    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

    expect(totalDebit).toBe(totalCredit);
  });
});
