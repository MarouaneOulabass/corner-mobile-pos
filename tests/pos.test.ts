import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

// ─── Pure cart/discount/payment logic extracted for testing ──────────────────

interface CartItem {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
}

function calculateSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
}

function applyFlatDiscount(subtotal: number, discount: number): number {
  const capped = Math.min(discount, subtotal);
  return subtotal - capped;
}

function applyPercentageDiscount(subtotal: number, percentage: number): number {
  const discount = Math.round(subtotal * (percentage / 100));
  return subtotal - discount;
}

function capDiscount(subtotal: number, discount: number): number {
  return Math.min(discount, subtotal);
}

function validateSplitPayment(amounts: number[], total: number): boolean {
  const sum = amounts.reduce((s, a) => s + a, 0);
  return Math.abs(sum - total) < 0.01;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Cart subtotal calculation', () => {
  it('calculates subtotal with multiple items', () => {
    const items: CartItem[] = [
      { id: '1', name: 'iPhone 13', unit_price: 3200, quantity: 1 },
      { id: '2', name: 'Coque', unit_price: 80, quantity: 2 },
      { id: '3', name: 'Chargeur', unit_price: 150, quantity: 1 },
    ];
    expect(calculateSubtotal(items)).toBe(3200 + 160 + 150);
  });

  it('returns 0 for empty cart', () => {
    expect(calculateSubtotal([])).toBe(0);
  });

  it('handles single item with quantity > 1', () => {
    const items: CartItem[] = [
      { id: '1', name: 'Film ecran', unit_price: 30, quantity: 5 },
    ];
    expect(calculateSubtotal(items)).toBe(150);
  });
});

describe('Flat discount', () => {
  it('applies flat discount correctly', () => {
    expect(applyFlatDiscount(3510, 100)).toBe(3410);
  });

  it('discount of 0 does not change total', () => {
    expect(applyFlatDiscount(3510, 0)).toBe(3510);
  });

  it('discount equal to subtotal results in 0', () => {
    expect(applyFlatDiscount(500, 500)).toBe(0);
  });
});

describe('Percentage discount', () => {
  it('applies 10% discount correctly', () => {
    expect(applyPercentageDiscount(3000, 10)).toBe(2700);
  });

  it('applies 50% discount correctly', () => {
    expect(applyPercentageDiscount(2000, 50)).toBe(1000);
  });

  it('0% discount does not change total', () => {
    expect(applyPercentageDiscount(1000, 0)).toBe(1000);
  });

  it('100% discount results in 0', () => {
    expect(applyPercentageDiscount(5000, 100)).toBe(0);
  });
});

describe('Discount cap', () => {
  it('discount cannot exceed subtotal', () => {
    expect(capDiscount(500, 700)).toBe(500);
  });

  it('discount at subtotal returns subtotal', () => {
    expect(capDiscount(500, 500)).toBe(500);
  });

  it('discount below subtotal is unchanged', () => {
    expect(capDiscount(500, 200)).toBe(200);
  });
});

describe('Split payment validation', () => {
  it('amounts that sum to total are valid', () => {
    expect(validateSplitPayment([2000, 1200], 3200)).toBe(true);
  });

  it('amounts that do not sum to total are invalid', () => {
    expect(validateSplitPayment([2000, 1000], 3200)).toBe(false);
  });

  it('single payment equal to total is valid', () => {
    expect(validateSplitPayment([3200], 3200)).toBe(true);
  });

  it('three-way split summing to total is valid', () => {
    expect(validateSplitPayment([1000, 1000, 1200], 3200)).toBe(true);
  });
});

describe('Idempotency key (UUID v4)', () => {
  it('generates a valid UUID v4 string', () => {
    const key = uuidv4();
    // UUID v4 format: 8-4-4-4-12 hex chars with version=4
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(key).toMatch(uuidRegex);
  });

  it('generates unique keys on each call', () => {
    const key1 = uuidv4();
    const key2 = uuidv4();
    expect(key1).not.toBe(key2);
  });
});
