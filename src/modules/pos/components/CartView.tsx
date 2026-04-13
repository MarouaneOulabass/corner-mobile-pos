'use client';

import React from 'react';
import { formatPrice, conditionLabels } from '@/lib/utils';
import type { CartItem } from '@/types';

interface CartViewProps {
  cart: CartItem[];
  hasPriceBelowCost: boolean;
  onUpdatePrice: (index: number, val: string) => void;
  onUpdateQuantity: (index: number, qty: number) => void;
  onRemove: (index: number) => void;
}

export default function CartView({
  cart,
  hasPriceBelowCost,
  onUpdatePrice,
  onUpdateQuantity,
  onRemove,
}: CartViewProps) {
  return (
    <>
      {/* Price below cost warning */}
      {hasPriceBelowCost && (
        <div className="bg-yellow-900/50 border border-yellow-600 rounded-xl p-3 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-yellow-200">
            Attention : un ou plusieurs articles sont vendus en dessous du prix d&apos;achat
          </p>
        </div>
      )}

      {/* Cart items */}
      <div className="space-y-2 mb-4">
        {cart.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-8 text-center">
            <svg className="w-12 h-12 text-slate-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <p className="text-slate-500 text-sm">Le panier est vide</p>
          </div>
        ) : (
          cart.map((item, index) => (
            <div key={`${item.product.id}_${index}`} className="bg-slate-800 rounded-xl p-3">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.product.brand} {item.product.model}
                    {item.product.storage ? ` ${item.product.storage}` : ''}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {conditionLabels[item.product.condition] || item.product.condition}
                    {item.product.imei ? ` \u2014 ${item.product.imei}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => onRemove(index)}
                  className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-3 mt-2">
                {/* Quantity controls (accessories only) */}
                {item.product.product_type === 'accessory' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
                    >
                      +
                    </button>
                  </div>
                )}

                {/* Inline editable price */}
                <div className="flex items-center gap-1 ml-auto">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.unit_price}
                    onChange={(e) => onUpdatePrice(index, e.target.value)}
                    className="w-24 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-right text-white focus:outline-none focus:ring-1 focus:ring-[#2AA8DC] focus:border-transparent"
                  />
                  <span className="text-xs text-slate-400">MAD</span>
                </div>
              </div>

              {/* Per-item below-cost indicator */}
              {item.unit_price < item.product.purchase_price && item.product.purchase_price > 0 && (
                <p className="text-xs text-yellow-400 mt-1">
                  Prix d&apos;achat : {formatPrice(item.product.purchase_price)}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
