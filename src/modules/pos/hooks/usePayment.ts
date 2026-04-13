'use client';

import { useState } from 'react';
import { formatPrice } from '@/lib/utils';
import type { PaymentMethod } from '@/types';

export function usePayment() {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [mixteAmounts, setMixteAmounts] = useState({ cash: '', card: '' });

  // --- Gift card state ---
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardBalance, setGiftCardBalance] = useState(0);
  const [giftCardAmount, setGiftCardAmount] = useState(0);

  // --- Loyalty state ---
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyRedeemAmount, setLoyaltyRedeemAmount] = useState(0);
  const [loyaltyRedemptionRate, setLoyaltyRedemptionRate] = useState(0);

  // --- Store credit state ---
  const [customerStoreCredit, setCustomerStoreCredit] = useState(0);
  const [storeCreditAmount, setStoreCreditAmount] = useState(0);

  const handleGiftCardRedeem = (code: string, balance: number, remainingAfterDiscounts: number) => {
    setGiftCardCode(code);
    setGiftCardBalance(balance);
    setGiftCardAmount(Math.min(balance, remainingAfterDiscounts));
  };

  const handleLoyaltyRedeem = async (customerId: string) => {
    if (loyaltyPoints <= 0 || loyaltyRedemptionRate <= 0) return;
    try {
      const res = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          points: loyaltyPoints,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const redeemValue = data.discount || (loyaltyPoints * loyaltyRedemptionRate);
        setLoyaltyRedeemAmount(redeemValue);
      }
    } catch {
      // silent
    }
  };

  const selectPaymentMethod = (key: PaymentMethod, totalAfterGiftCard: number) => {
    setPaymentMethod(key);
    if (key === 'store_credit') {
      const remaining = Math.max(0, totalAfterGiftCard);
      setStoreCreditAmount(Math.min(customerStoreCredit, remaining));
    } else {
      setStoreCreditAmount(0);
    }
  };

  const computeTotal = (subtotal: number, discountAmount: number) => {
    const totalBeforeExtras = Math.max(0, subtotal - discountAmount);
    const totalAfterLoyalty = Math.max(0, totalBeforeExtras - loyaltyRedeemAmount);
    const totalAfterGiftCard = Math.max(0, totalAfterLoyalty - giftCardAmount);
    const total = paymentMethod === 'store_credit'
      ? Math.max(0, totalAfterGiftCard - storeCreditAmount)
      : totalAfterGiftCard;
    return { totalBeforeExtras, totalAfterLoyalty, totalAfterGiftCard, total };
  };

  const resetLoyalty = () => {
    setLoyaltyPoints(0);
    setLoyaltyRedeemAmount(0);
    setLoyaltyRedemptionRate(0);
    setCustomerStoreCredit(0);
    setStoreCreditAmount(0);
  };

  const fetchLoyaltyForCustomer = async (customerId: string, storeCredit: number) => {
    setCustomerStoreCredit(storeCredit);
    try {
      const res = await fetch(`/api/loyalty?customer_id=${customerId}`);
      if (res.ok) {
        const data = await res.json();
        setLoyaltyPoints(data.points || 0);
        setLoyaltyRedemptionRate(data.redemption_rate || 0);
      }
    } catch {
      // silent
    }
  };

  const reset = () => {
    setPaymentMethod('cash');
    setMixteAmounts({ cash: '', card: '' });
    setGiftCardCode('');
    setGiftCardBalance(0);
    setGiftCardAmount(0);
    resetLoyalty();
  };

  return {
    paymentMethod,
    mixteAmounts,
    setMixteAmounts,
    giftCardCode,
    giftCardBalance,
    giftCardAmount,
    setGiftCardCode,
    setGiftCardBalance,
    setGiftCardAmount,
    loyaltyPoints,
    loyaltyRedeemAmount,
    setLoyaltyRedeemAmount,
    loyaltyRedemptionRate,
    customerStoreCredit,
    storeCreditAmount,
    setStoreCreditAmount,
    handleGiftCardRedeem,
    handleLoyaltyRedeem,
    selectPaymentMethod,
    computeTotal,
    resetLoyalty,
    fetchLoyaltyForCustomer,
    reset,
    // Expose formatPrice for convenience
    formatPrice,
  };
}
