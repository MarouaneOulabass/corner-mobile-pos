import { describe, it, expect } from 'vitest';
import {
  generateRecoveryCodes,
  verifyRecoveryCode,
} from '@/modules/core/services/two-factor';

describe('generateRecoveryCodes', () => {
  it('returns exactly 8 codes', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
  });

  it('each code is 8 hex characters', () => {
    const codes = generateRecoveryCodes();
    for (const code of codes) {
      expect(code).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it('codes are unique within a set', () => {
    const codes = generateRecoveryCodes();
    const uniqueSet = new Set(codes);
    expect(uniqueSet.size).toBe(codes.length);
  });

  it('two calls produce different sets of codes', () => {
    const codes1 = generateRecoveryCodes();
    const codes2 = generateRecoveryCodes();
    // Extremely unlikely to collide; check at least one differs
    expect(codes1).not.toEqual(codes2);
  });
});

describe('verifyRecoveryCode', () => {
  it('valid code returns valid=true and remaining has 7 codes', () => {
    const codes = generateRecoveryCodes();
    const codeToUse = codes[0];

    const result = verifyRecoveryCode(codes, codeToUse);
    expect(result.valid).toBe(true);
    expect(result.remaining).toHaveLength(7);
    expect(result.remaining).not.toContain(codeToUse);
  });

  it('invalid code returns valid=false and codes unchanged', () => {
    const codes = generateRecoveryCodes();

    const result = verifyRecoveryCode(codes, 'zzzzzzzz');
    expect(result.valid).toBe(false);
    expect(result.remaining).toHaveLength(8);
    expect(result.remaining).toEqual(codes);
  });

  it('code matching is case-insensitive', () => {
    const codes = generateRecoveryCodes();
    const codeToUse = codes[3].toUpperCase();

    const result = verifyRecoveryCode(codes, codeToUse);
    expect(result.valid).toBe(true);
    expect(result.remaining).toHaveLength(7);
  });

  it('used code cannot be reused', () => {
    const codes = generateRecoveryCodes();
    const codeToUse = codes[2];

    const first = verifyRecoveryCode(codes, codeToUse);
    expect(first.valid).toBe(true);

    const second = verifyRecoveryCode(first.remaining, codeToUse);
    expect(second.valid).toBe(false);
  });
});
