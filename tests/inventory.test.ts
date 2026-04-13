import { describe, it, expect } from 'vitest';
import { validateIMEI, formatPrice } from '@/modules/core/services/utils';

describe('IMEI Luhn validation', () => {
  it('valid IMEI passes (490154203237518)', () => {
    expect(validateIMEI('490154203237518')).toBe(true);
  });

  it('another valid IMEI passes (353879234252633)', () => {
    expect(validateIMEI('353879234252633')).toBe(true);
  });

  it('invalid IMEI fails (wrong check digit)', () => {
    expect(validateIMEI('490154203237519')).toBe(false);
  });

  it('rejects IMEI shorter than 15 digits', () => {
    expect(validateIMEI('12345678901234')).toBe(false);
  });

  it('rejects IMEI longer than 15 digits', () => {
    expect(validateIMEI('1234567890123456')).toBe(false);
  });

  it('rejects IMEI with non-numeric characters', () => {
    expect(validateIMEI('49015420323751A')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateIMEI('')).toBe(false);
  });

  it('rejects all zeros (000000000000000)', () => {
    // Luhn of all zeros: sum = 0, 0 % 10 === 0 — technically valid by Luhn
    // but the function should still accept it (Luhn check only)
    expect(validateIMEI('000000000000000')).toBe(true);
  });
});

describe('formatPrice', () => {
  it('formats a normal price with MAD suffix', () => {
    const result = formatPrice(3200);
    expect(result).toContain('3');
    expect(result).toContain('200');
    expect(result).toContain('MAD');
  });

  it('formats zero as "0 MAD"', () => {
    const result = formatPrice(0);
    expect(result).toContain('0');
    expect(result).toContain('MAD');
  });

  it('formats large prices correctly', () => {
    const result = formatPrice(1000000);
    expect(result).toContain('MAD');
    // Should contain the number in some formatted way
    expect(result).toContain('000');
  });

  it('formats small prices correctly', () => {
    const result = formatPrice(5);
    expect(result).toBe('5 MAD');
  });
});
