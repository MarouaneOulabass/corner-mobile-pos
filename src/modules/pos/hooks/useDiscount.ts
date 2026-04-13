'use client';

import { useState } from 'react';

export function useDiscount() {
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState('');

  const discountNum = parseFloat(discountValue) || 0;

  const computeDiscountAmount = (subtotal: number) => {
    return discountType === 'percentage'
      ? Math.round((subtotal * discountNum) / 100)
      : discountNum;
  };

  const reset = () => {
    setDiscountValue('');
    setDiscountType('flat');
  };

  return {
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    discountNum,
    computeDiscountAmount,
    reset,
  };
}
