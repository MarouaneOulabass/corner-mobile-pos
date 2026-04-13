'use client';

import React from 'react';
import { formatPrice } from '@/lib/utils';
import type { PaymentMethod, Customer } from '@/types';
import GiftCardInput from '@/components/features/GiftCardInput';

interface PaymentDialogProps {
  paymentMethod: PaymentMethod;
  onSelectPaymentMethod: (key: PaymentMethod) => void;
  mixteAmounts: { cash: string; card: string };
  onSetMixteAmounts: (v: { cash: string; card: string }) => void;

  // Gift card
  giftCardAmount: number;
  onGiftCardRedeem: (code: string, balance: number) => void;
  onClearGiftCard: () => void;

  // Store credit
  selectedCustomer: Customer | null;
  customerStoreCredit: number;
  storeCreditAmount: number;
  onSetStoreCreditAmount: (v: number) => void;
  totalAfterGiftCard: number;

  // Discount section
  discountType: 'flat' | 'percentage';
  onSetDiscountType: (v: 'flat' | 'percentage') => void;
  discountValue: string;
  onSetDiscountValue: (v: string) => void;

  // Customer section
  customerSearch: string;
  onSetCustomerSearch: (v: string) => void;
  customerResults: Customer[];
  onSelectCustomer: (c: Customer) => void;
  onClearCustomer: () => void;
  showNewCustomer: boolean;
  onSetShowNewCustomer: (v: boolean) => void;
  newCustomerName: string;
  onSetNewCustomerName: (v: string) => void;
  newCustomerPhone: string;
  onSetNewCustomerPhone: (v: string) => void;

  // Loyalty
  loyaltyPoints: number;
  loyaltyRedemptionRate: number;
  loyaltyRedeemAmount: number;
  onLoyaltyRedeem: () => void;
  onClearLoyaltyRedeem: () => void;
}

export default function PaymentDialog({
  paymentMethod,
  onSelectPaymentMethod,
  mixteAmounts,
  onSetMixteAmounts,
  giftCardAmount,
  onGiftCardRedeem,
  onClearGiftCard,
  selectedCustomer,
  customerStoreCredit,
  storeCreditAmount,
  onSetStoreCreditAmount,
  totalAfterGiftCard,
  discountType,
  onSetDiscountType,
  discountValue,
  onSetDiscountValue,
  customerSearch,
  onSetCustomerSearch,
  customerResults,
  onSelectCustomer,
  onClearCustomer,
  showNewCustomer,
  onSetShowNewCustomer,
  newCustomerName,
  onSetNewCustomerName,
  newCustomerPhone,
  onSetNewCustomerPhone,
  loyaltyPoints,
  loyaltyRedemptionRate,
  loyaltyRedeemAmount,
  onLoyaltyRedeem,
  onClearLoyaltyRedeem,
}: PaymentDialogProps) {
  return (
    <>
      {/* Discount */}
      <div className="bg-slate-800 rounded-xl p-3 mb-4">
        <p className="text-xs font-semibold text-slate-400 mb-2">REMISE</p>
        <div className="flex gap-2">
          <div className="flex bg-slate-900 rounded-lg p-0.5 flex-shrink-0">
            <button
              onClick={() => onSetDiscountType('flat')}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                discountType === 'flat' ? 'bg-[#2AA8DC] text-white' : 'text-slate-400'
              }`}
            >
              MAD
            </button>
            <button
              onClick={() => onSetDiscountType('percentage')}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                discountType === 'percentage' ? 'bg-[#2AA8DC] text-white' : 'text-slate-400'
              }`}
            >
              %
            </button>
          </div>
          <input
            type="number"
            inputMode="decimal"
            value={discountValue}
            onChange={(e) => onSetDiscountValue(e.target.value)}
            placeholder={discountType === 'flat' ? 'Montant' : 'Pourcentage'}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
          />
        </div>
      </div>

      {/* Customer */}
      <div className="bg-slate-800 rounded-xl p-3 mb-4">
        <p className="text-xs font-semibold text-slate-400 mb-2">CLIENT</p>

        {selectedCustomer ? (
          <div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-sm font-medium">{selectedCustomer.name}</p>
                  <p className="text-xs text-slate-400">{selectedCustomer.phone}</p>
                </div>
                {loyaltyPoints > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs bg-yellow-900/50 text-yellow-300 border border-yellow-700 px-2 py-0.5 rounded-full font-medium">
                    {'\u2B50'} {loyaltyPoints} pts
                  </span>
                )}
              </div>
              <button
                onClick={onClearCustomer}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Retirer
              </button>
            </div>

            {/* Loyalty redeem section */}
            {loyaltyPoints > 0 && loyaltyRedemptionRate > 0 && loyaltyRedeemAmount === 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    {loyaltyPoints} pts = {formatPrice(loyaltyPoints * loyaltyRedemptionRate)}
                  </p>
                  <button
                    onClick={onLoyaltyRedeem}
                    className="text-xs bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded-lg font-medium transition-colors"
                  >
                    Utiliser points
                  </button>
                </div>
              </div>
            )}

            {loyaltyRedeemAmount > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-green-400 font-medium">
                    Points utilis&eacute;s : -{formatPrice(loyaltyRedeemAmount)}
                  </p>
                  <button
                    onClick={onClearLoyaltyRedeem}
                    className="text-xs text-slate-400 hover:text-slate-300"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Store credit display */}
            {customerStoreCredit > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    Avoir disponible : {formatPrice(customerStoreCredit)}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => { onSetCustomerSearch(e.target.value); onSetShowNewCustomer(false); }}
              placeholder="Rechercher par t&#233;l&#233;phone..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC] mb-2"
            />

            {customerResults.length > 0 && (
              <div className="space-y-1 mb-2">
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelectCustomer(c)}
                    className="w-full text-left p-2 bg-slate-900 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                  >
                    {c.name} &mdash; {c.phone}
                  </button>
                ))}
              </div>
            )}

            {!showNewCustomer ? (
              <button
                onClick={() => onSetShowNewCustomer(true)}
                className="text-sm text-[#2AA8DC] hover:text-[#2596c4] flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nouveau client
              </button>
            ) : (
              <div className="space-y-2 bg-slate-900 rounded-lg p-2">
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => onSetNewCustomerName(e.target.value)}
                  placeholder="Nom du client"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
                />
                <input
                  type="tel"
                  value={newCustomerPhone}
                  onChange={(e) => onSetNewCustomerPhone(e.target.value)}
                  placeholder="T&#233;l&#233;phone"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment method */}
      <div className="bg-slate-800 rounded-xl p-3 mb-4">
        <p className="text-xs font-semibold text-slate-400 mb-2">PAIEMENT</p>
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'cash' as PaymentMethod, label: 'Esp\u00e8ces' },
            { key: 'card' as PaymentMethod, label: 'Carte' },
            { key: 'virement' as PaymentMethod, label: 'Virement' },
            { key: 'mixte' as PaymentMethod, label: 'Mixte' },
            { key: 'gift_card' as PaymentMethod, label: 'Carte cadeau' },
            ...(selectedCustomer && customerStoreCredit > 0
              ? [{ key: 'store_credit' as PaymentMethod, label: 'Avoir' }]
              : []),
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onSelectPaymentMethod(key)}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors min-w-[70px] ${
                paymentMethod === key
                  ? 'bg-[#2AA8DC] text-white'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Mixte payment fields */}
        {paymentMethod === 'mixte' && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Esp&egrave;ces</label>
              <input
                type="number"
                inputMode="decimal"
                value={mixteAmounts.cash}
                onChange={(e) => onSetMixteAmounts({ ...mixteAmounts, cash: e.target.value })}
                placeholder="0"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Carte</label>
              <input
                type="number"
                inputMode="decimal"
                value={mixteAmounts.card}
                onChange={(e) => onSetMixteAmounts({ ...mixteAmounts, card: e.target.value })}
                placeholder="0"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
              />
            </div>
          </div>
        )}

        {/* Gift card input */}
        {paymentMethod === 'gift_card' && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <GiftCardInput onRedeem={onGiftCardRedeem} />
            {giftCardAmount > 0 && (
              <div className="flex items-center justify-between mt-2 bg-green-900/30 border border-green-800 rounded-lg px-3 py-2">
                <p className="text-xs text-green-400 font-medium">
                  Carte cadeau : -{formatPrice(giftCardAmount)}
                </p>
                <button
                  onClick={onClearGiftCard}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Retirer
                </button>
              </div>
            )}
          </div>
        )}

        {/* Store credit (Avoir) details */}
        {paymentMethod === 'store_credit' && selectedCustomer && customerStoreCredit > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400">
                Avoir disponible : {formatPrice(customerStoreCredit)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={storeCreditAmount || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  onSetStoreCreditAmount(Math.min(val, customerStoreCredit, totalAfterGiftCard));
                }}
                placeholder="Montant"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
              />
              <span className="text-xs text-slate-400">MAD</span>
            </div>
            {storeCreditAmount > 0 && totalAfterGiftCard - storeCreditAmount > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                Reste &agrave; payer : {formatPrice(totalAfterGiftCard - storeCreditAmount)}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
