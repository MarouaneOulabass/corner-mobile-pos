'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Sale } from '@/types';

// Hooks
import { useCart } from '@/modules/pos/hooks/useCart';
import { useOfflineQueue } from '@/modules/pos/hooks/useOfflineQueue';
import { useDiscount } from '@/modules/pos/hooks/useDiscount';
import { usePayment } from '@/modules/pos/hooks/usePayment';
import { useCustomerSearch } from '@/modules/pos/hooks/useCustomerSearch';

// Components
import OfflineBanner from '@/modules/pos/components/OfflineBanner';
import ProductSearch from '@/modules/pos/components/ProductSearch';
import CartView from '@/modules/pos/components/CartView';
import PaymentDialog from '@/modules/pos/components/PaymentDialog';
import BottomTotals from '@/modules/pos/components/BottomTotals';
import ReceiptScreen from '@/modules/pos/components/ReceiptScreen';

export default function POSPage() {
  const { user, activeStoreId } = useAuth();
  const storeId = activeStoreId || user?.store_id || '';

  const cartHook = useCart(storeId, user?.id || '');
  const offline = useOfflineQueue();
  const discount = useDiscount();
  const payment = usePayment();
  const customer = useCustomerSearch();

  const [submitting, setSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Fetch loyalty when customer changes
  useEffect(() => {
    if (!customer.selectedCustomer) {
      payment.resetLoyalty();
      return;
    }
    payment.fetchLoyaltyForCustomer(
      customer.selectedCustomer.id,
      customer.selectedCustomer.store_credit || 0
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.selectedCustomer]);

  // Computed values
  const discountAmount = discount.computeDiscountAmount(cartHook.subtotal);
  const { totalAfterGiftCard, total } = payment.computeTotal(cartHook.subtotal, discountAmount);

  const resetForm = useCallback(() => {
    cartHook.clearCart();
    discount.reset();
    customer.reset();
    payment.reset();
    setCompletedSale(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Submit sale
  const handleSubmit = async () => {
    if (cartHook.cart.length === 0) return;
    setSubmitting(true);

    const saleData = {
      items: cartHook.cart.map((i) => ({
        product_id: i.product.id.startsWith('manual_') ? null : i.product.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        original_price: i.original_price,
      })),
      customer_id: customer.selectedCustomer?.id || null,
      customer_phone: !customer.selectedCustomer && customer.newCustomerPhone ? customer.newCustomerPhone : null,
      customer_name: !customer.selectedCustomer && customer.newCustomerName ? customer.newCustomerName : null,
      discount_amount: discount.discountNum,
      discount_type: discount.discountNum > 0 ? discount.discountType : null,
      payment_method: payment.paymentMethod,
      payment_details:
        payment.paymentMethod === 'mixte'
          ? { cash: parseFloat(payment.mixteAmounts.cash) || 0, card: parseFloat(payment.mixteAmounts.card) || 0 }
          : null,
      gift_card_code: payment.giftCardAmount > 0 ? payment.giftCardCode : null,
      gift_card_amount: payment.giftCardAmount > 0 ? payment.giftCardAmount : null,
      loyalty_redeem_amount: payment.loyaltyRedeemAmount > 0 ? payment.loyaltyRedeemAmount : null,
      store_credit_amount: payment.paymentMethod === 'store_credit' && payment.storeCreditAmount > 0 ? payment.storeCreditAmount : null,
    };

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      });
      if (res.ok) {
        setCompletedSale(await res.json());
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur lors de la vente');
      }
    } catch {
      offline.queueSale(saleData);
      alert('Vente sauvegard\u00e9e hors ligne. Elle sera synchronis\u00e9e automatiquement.');
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  // --- Receipt screen ---
  if (completedSale) {
    return (
      <ReceiptScreen
        sale={completedSale}
        user={user}
        storeId={storeId}
        newCustomerPhone={customer.newCustomerPhone}
        onNewSale={resetForm}
      />
    );
  }

  // --- Main POS screen ---
  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      <OfflineBanner
        isOffline={offline.isOffline}
        offlineCount={offline.offlineCount}
        syncResult={offline.syncResult}
      />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 max-w-lg mx-auto">
        <a href="/" className="flex items-center gap-2 text-white/70 hover:text-white transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-xs">Accueil</span>
        </a>
        <h1 className="text-lg font-bold">Point de vente</h1>
        <a href="/stock" className="text-xs text-white/70 hover:text-white transition">Stock</a>
      </div>

      <div className="p-4 max-w-lg mx-auto pb-48">
        <ProductSearch
          storeId={storeId}
          onAddToCart={cartHook.addToCart}
          showManualEntry={cartHook.showManualEntry}
          setShowManualEntry={cartHook.setShowManualEntry}
          manualName={cartHook.manualName}
          setManualName={cartHook.setManualName}
          manualPrice={cartHook.manualPrice}
          setManualPrice={cartHook.setManualPrice}
          onAddManualAccessory={cartHook.addManualAccessory}
        />

        <CartView
          cart={cartHook.cart}
          hasPriceBelowCost={cartHook.hasPriceBelowCost}
          onUpdatePrice={cartHook.updateItemPrice}
          onUpdateQuantity={cartHook.updateItemQuantity}
          onRemove={cartHook.removeFromCart}
        />

        {cartHook.cart.length > 0 && (
          <PaymentDialog
            discountType={discount.discountType}
            onSetDiscountType={discount.setDiscountType}
            discountValue={discount.discountValue}
            onSetDiscountValue={discount.setDiscountValue}
            customerSearch={customer.customerSearch}
            onSetCustomerSearch={customer.setCustomerSearch}
            customerResults={customer.customerResults}
            selectedCustomer={customer.selectedCustomer}
            onSelectCustomer={customer.selectCustomer}
            onClearCustomer={customer.clearCustomer}
            showNewCustomer={customer.showNewCustomer}
            onSetShowNewCustomer={customer.setShowNewCustomer}
            newCustomerName={customer.newCustomerName}
            onSetNewCustomerName={customer.setNewCustomerName}
            newCustomerPhone={customer.newCustomerPhone}
            onSetNewCustomerPhone={customer.setNewCustomerPhone}
            paymentMethod={payment.paymentMethod}
            onSelectPaymentMethod={(key) => payment.selectPaymentMethod(key, totalAfterGiftCard)}
            mixteAmounts={payment.mixteAmounts}
            onSetMixteAmounts={payment.setMixteAmounts}
            giftCardAmount={payment.giftCardAmount}
            onGiftCardRedeem={(code, balance) => {
              const remaining = Math.max(0, cartHook.subtotal - discountAmount - payment.loyaltyRedeemAmount);
              payment.handleGiftCardRedeem(code, balance, remaining);
            }}
            onClearGiftCard={() => {
              payment.setGiftCardCode('');
              payment.setGiftCardBalance(0);
              payment.setGiftCardAmount(0);
            }}
            customerStoreCredit={payment.customerStoreCredit}
            storeCreditAmount={payment.storeCreditAmount}
            onSetStoreCreditAmount={payment.setStoreCreditAmount}
            totalAfterGiftCard={totalAfterGiftCard}
            loyaltyPoints={payment.loyaltyPoints}
            loyaltyRedemptionRate={payment.loyaltyRedemptionRate}
            loyaltyRedeemAmount={payment.loyaltyRedeemAmount}
            onLoyaltyRedeem={() => {
              if (customer.selectedCustomer) {
                payment.handleLoyaltyRedeem(customer.selectedCustomer.id);
              }
            }}
            onClearLoyaltyRedeem={() => payment.setLoyaltyRedeemAmount(0)}
          />
        )}
      </div>

      {cartHook.cart.length > 0 && (
        <BottomTotals
          subtotal={cartHook.subtotal}
          discountAmount={discountAmount}
          discountType={discount.discountType}
          discountNum={discount.discountNum}
          loyaltyRedeemAmount={payment.loyaltyRedeemAmount}
          giftCardAmount={payment.giftCardAmount}
          paymentMethod={payment.paymentMethod}
          storeCreditAmount={payment.storeCreditAmount}
          total={total}
          submitting={submitting}
          cartEmpty={cartHook.cart.length === 0}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
