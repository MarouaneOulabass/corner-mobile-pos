'use client';

import React from 'react';
import { formatPrice } from '@/lib/utils';
import type { PaymentMethod } from '@/types';

interface BottomTotalsProps {
  subtotal: number;
  discountAmount: number;
  discountType: 'flat' | 'percentage';
  discountNum: number;
  loyaltyRedeemAmount: number;
  giftCardAmount: number;
  paymentMethod: PaymentMethod;
  storeCreditAmount: number;
  total: number;
  submitting: boolean;
  cartEmpty: boolean;
  onSubmit: () => void;
}

export default function BottomTotals({
  subtotal,
  discountAmount,
  discountType,
  discountNum,
  loyaltyRedeemAmount,
  giftCardAmount,
  paymentMethod,
  storeCreditAmount,
  total,
  submitting,
  cartEmpty,
  onSubmit,
}: BottomTotalsProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4 z-30">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between items-center text-sm mb-1">
          <span className="text-slate-400">Sous-total</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between items-center text-sm mb-1 text-yellow-400">
            <span>Remise{discountType === 'percentage' ? ` (${discountNum}%)` : ''}</span>
            <span>-{formatPrice(discountAmount)}</span>
          </div>
        )}
        {loyaltyRedeemAmount > 0 && (
          <div className="flex justify-between items-center text-sm mb-1 text-yellow-300">
            <span>Points fid&eacute;lit&eacute;</span>
            <span>-{formatPrice(loyaltyRedeemAmount)}</span>
          </div>
        )}
        {giftCardAmount > 0 && (
          <div className="flex justify-between items-center text-sm mb-1 text-green-400">
            <span>Carte cadeau</span>
            <span>-{formatPrice(giftCardAmount)}</span>
          </div>
        )}
        {paymentMethod === 'store_credit' && storeCreditAmount > 0 && (
          <div className="flex justify-between items-center text-sm mb-1 text-purple-400">
            <span>Avoir</span>
            <span>-{formatPrice(storeCreditAmount)}</span>
          </div>
        )}
        <div className="flex justify-between items-center text-lg font-bold mb-3">
          <span>Total</span>
          <span className="text-[#2AA8DC]">{formatPrice(total)}</span>
        </div>

        <button
          onClick={onSubmit}
          disabled={submitting || cartEmpty}
          className="w-full bg-[#2AA8DC] hover:bg-[#2596c4] disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Traitement...
            </>
          ) : (
            'Confirmer la vente'
          )}
        </button>
      </div>
    </div>
  );
}
