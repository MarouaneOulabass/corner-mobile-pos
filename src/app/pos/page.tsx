'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatPrice, conditionLabels, generateWhatsAppLink, formatDateTime } from '@/lib/utils';
import type { Product, CartItem, Customer, PaymentMethod, Sale } from '@/types';
import IMEIScanner from '@/components/features/IMEIScanner';
import GiftCardInput from '@/components/features/GiftCardInput';
import ThermalPrintButton from '@/components/features/ThermalPrintButton';
import ReceiptPreview from '@/components/features/ReceiptPreview';
import { buildReceiptHTML, buildReceiptESCPOS } from '@/lib/receipt-builder';

const OFFLINE_QUEUE_KEY = 'corner_pos_offline_queue';

function getOfflineQueue(): unknown[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addToOfflineQueue(saleData: unknown) {
  const queue = getOfflineQueue();
  queue.push(saleData);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function clearOfflineQueue() {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

export default function POSPage() {
  const { user } = useAuth();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState('');

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const customerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [mixteAmounts, setMixteAmounts] = useState({ cash: '', card: '' });

  const [submitting, setSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  const [isOffline, setIsOffline] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);

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

  // --- Receipt preview state ---
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);

  // --- Offline detection & sync ---
  const syncOfflineQueue = useCallback(async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;
    const failed: unknown[] = [];
    for (const sd of queue) {
      try {
        const r = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sd),
        });
        if (!r.ok) failed.push(sd);
      } catch {
        failed.push(sd);
      }
    }
    if (failed.length > 0) {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failed));
    } else {
      clearOfflineQueue();
    }
    setOfflineCount(failed.length);
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setIsOffline(false);
      syncOfflineQueue();
    };
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    setIsOffline(!navigator.onLine);
    setOfflineCount(getOfflineQueue().length);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [syncOfflineQueue]);

  // --- Fetch loyalty points when customer selected ---
  useEffect(() => {
    if (!selectedCustomer) {
      setLoyaltyPoints(0);
      setLoyaltyRedeemAmount(0);
      setLoyaltyRedemptionRate(0);
      setCustomerStoreCredit(0);
      setStoreCreditAmount(0);
      return;
    }

    // Fetch loyalty
    (async () => {
      try {
        const res = await fetch(`/api/loyalty?customer_id=${selectedCustomer.id}`);
        if (res.ok) {
          const data = await res.json();
          setLoyaltyPoints(data.points || 0);
          setLoyaltyRedemptionRate(data.redemption_rate || 0);
        }
      } catch {
        // silent
      }
    })();

    // Fetch store credit from customer record
    setCustomerStoreCredit(selectedCustomer.store_credit || 0);
  }, [selectedCustomer]);

  // --- Product search ---
  const searchProducts = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }
      setSearching(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('status', 'in_stock')
          .eq('store_id', user?.store_id || '')
          .or(`imei.ilike.%${query}%,model.ilike.%${query}%,brand.ilike.%${query}%`)
          .limit(10);

        if (!error && data) {
          setSearchResults(data);
          setShowResults(true);
        }
      } catch {
        // silent
      } finally {
        setSearching(false);
      }
    },
    [user?.store_id]
  );

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchProducts(searchQuery), 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, searchProducts]);

  // --- Customer search ---
  const searchCustomers = useCallback(async (query: string) => {
    if (query.length < 3) {
      setCustomerResults([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`phone.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(5);

      if (!error && data) setCustomerResults(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (customerTimeoutRef.current) clearTimeout(customerTimeoutRef.current);
    customerTimeoutRef.current = setTimeout(
      () => searchCustomers(customerSearch),
      300
    );
    return () => {
      if (customerTimeoutRef.current) clearTimeout(customerTimeoutRef.current);
    };
  }, [customerSearch, searchCustomers]);

  // --- Cart operations ---
  const addToCart = (product: Product) => {
    const existing = cart.find((i) => i.product.id === product.id);
    if (existing) {
      if (product.product_type === 'accessory') {
        setCart(
          cart.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        );
      }
      return;
    }
    setCart([
      ...cart,
      {
        product,
        quantity: 1,
        unit_price: product.selling_price,
        original_price: product.selling_price,
      },
    ]);
    setSearchQuery('');
    setShowResults(false);
  };

  const addManualAccessory = () => {
    if (!manualName || !manualPrice) return;
    const price = parseFloat(manualPrice);
    if (isNaN(price) || price < 0) return;

    const fakeProduct: Product = {
      id: `manual_${Date.now()}`,
      product_type: 'accessory',
      brand: 'Accessoire',
      model: manualName,
      condition: 'new',
      purchase_price: 0,
      selling_price: price,
      status: 'in_stock',
      store_id: user?.store_id || '',
      created_by: user?.id || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setCart([
      ...cart,
      { product: fakeProduct, quantity: 1, unit_price: price, original_price: price },
    ]);
    setManualName('');
    setManualPrice('');
    setShowManualEntry(false);
  };

  const updateItemPrice = (index: number, val: string) => {
    const p = parseFloat(val);
    if (isNaN(p) || p < 0) return;
    setCart(cart.map((item, i) => (i === index ? { ...item, unit_price: p } : item)));
  };

  const updateItemQuantity = (index: number, qty: number) => {
    if (qty < 1) return;
    setCart(cart.map((item, i) => (i === index ? { ...item, quantity: qty } : item)));
  };

  const removeFromCart = (index: number) =>
    setCart(cart.filter((_, i) => i !== index));

  // --- Gift card handler ---
  const handleGiftCardRedeem = (code: string, balance: number) => {
    setGiftCardCode(code);
    setGiftCardBalance(balance);
    // Auto-set the gift card amount to min(balance, remaining total)
    const remainingAfterDiscounts = Math.max(0, subtotalCalc - discountAmountCalc - loyaltyRedeemAmount);
    setGiftCardAmount(Math.min(balance, remainingAfterDiscounts));
  };

  // --- Loyalty redeem handler ---
  const handleLoyaltyRedeem = async () => {
    if (!selectedCustomer || loyaltyPoints <= 0 || loyaltyRedemptionRate <= 0) return;
    try {
      const res = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
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

  // --- Calculations ---
  const subtotalCalc = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const subtotal = subtotalCalc;
  const discountNum = parseFloat(discountValue) || 0;
  const discountAmountCalc =
    discountType === 'percentage'
      ? Math.round((subtotal * discountNum) / 100)
      : discountNum;
  const discountAmount = discountAmountCalc;

  // Total after all deductions
  const totalBeforeExtras = Math.max(0, subtotal - discountAmount);
  const totalAfterLoyalty = Math.max(0, totalBeforeExtras - loyaltyRedeemAmount);
  const totalAfterGiftCard = Math.max(0, totalAfterLoyalty - giftCardAmount);
  const total = paymentMethod === 'store_credit'
    ? Math.max(0, totalAfterGiftCard - storeCreditAmount)
    : totalAfterGiftCard;

  const hasPriceBelowCost = cart.some(
    (i) => i.unit_price < i.product.purchase_price && i.product.purchase_price > 0
  );

  // --- Receipt data for thermal printing (memoized) ---
  const receiptESCPOS = useMemo(() => {
    if (!completedSale) return null;
    try {
      const store = { id: user?.store_id || '', name: 'Corner Mobile', location: '', created_at: '' };
      return buildReceiptESCPOS(completedSale, store);
    } catch {
      return null;
    }
  }, [completedSale, user?.store_id]);

  const receiptHTML = useMemo(() => {
    if (!completedSale) return '';
    try {
      const store = { id: user?.store_id || '', name: 'Corner Mobile', location: '', created_at: '' };
      const template = {
        id: 'default',
        store_id: user?.store_id || '',
        header_text: 'Corner Mobile',
        footer_text: '',
        show_logo: false,
        show_store_address: true,
        show_seller_name: true,
        show_qr_code: false,
        paper_width: '58mm' as const,
        font_size: 'medium' as const,
        updated_at: '',
      };
      return buildReceiptHTML(completedSale, template, store);
    } catch {
      return '';
    }
  }, [completedSale, user?.store_id]);

  // --- Submit sale ---
  const handleSubmit = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);

    const saleData = {
      items: cart.map((i) => ({
        product_id: i.product.id.startsWith('manual_') ? null : i.product.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        original_price: i.original_price,
      })),
      customer_id: selectedCustomer?.id || null,
      customer_phone: !selectedCustomer && newCustomerPhone ? newCustomerPhone : null,
      customer_name: !selectedCustomer && newCustomerName ? newCustomerName : null,
      discount_amount: discountNum,
      discount_type: discountNum > 0 ? discountType : null,
      payment_method: paymentMethod,
      payment_details:
        paymentMethod === 'mixte'
          ? { cash: parseFloat(mixteAmounts.cash) || 0, card: parseFloat(mixteAmounts.card) || 0 }
          : null,
      // Optional new payment data
      gift_card_code: giftCardAmount > 0 ? giftCardCode : null,
      gift_card_amount: giftCardAmount > 0 ? giftCardAmount : null,
      loyalty_redeem_amount: loyaltyRedeemAmount > 0 ? loyaltyRedeemAmount : null,
      store_credit_amount: paymentMethod === 'store_credit' && storeCreditAmount > 0 ? storeCreditAmount : null,
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
      addToOfflineQueue(saleData);
      setOfflineCount(getOfflineQueue().length);
      alert('Vente sauvegard\u00e9e hors ligne. Elle sera synchronis\u00e9e automatiquement.');
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCart([]);
    setSearchQuery('');
    setDiscountValue('');
    setDiscountType('flat');
    setSelectedCustomer(null);
    setCustomerSearch('');
    setNewCustomerName('');
    setNewCustomerPhone('');
    setShowNewCustomer(false);
    setPaymentMethod('cash');
    setMixteAmounts({ cash: '', card: '' });
    setCompletedSale(null);
    setGiftCardCode('');
    setGiftCardBalance(0);
    setGiftCardAmount(0);
    setLoyaltyPoints(0);
    setLoyaltyRedeemAmount(0);
    setLoyaltyRedemptionRate(0);
    setCustomerStoreCredit(0);
    setStoreCreditAmount(0);
    setShowReceiptPreview(false);
  };

  // --- WhatsApp receipt ---
  const generateReceiptMessage = (sale: Sale) => {
    const pmLabels: Record<string, string> = {
      cash: 'Esp\u00e8ces',
      card: 'Carte',
      virement: 'Virement',
      mixte: 'Mixte',
      gift_card: 'Carte cadeau',
      store_credit: 'Avoir',
    };
    let msg = '*Corner Mobile - Re\u00e7u*\n';
    msg += `Date: ${formatDateTime(sale.created_at)}\n`;
    msg += `Vendeur: ${sale.seller?.name || user?.name || ''}\n\n`;
    msg += '*Articles:*\n';
    sale.items?.forEach((item) => {
      const name = item.product
        ? `${item.product.brand} ${item.product.model}`
        : 'Article';
      msg += `- ${name} x${item.quantity}: ${formatPrice(item.unit_price * item.quantity)}\n`;
    });
    msg += '\n';
    if (sale.discount_amount > 0) {
      msg += `Remise: -${formatPrice(sale.discount_amount)}\n`;
    }
    msg += `*Total: ${formatPrice(sale.total)}*\n`;
    msg += `Paiement: ${pmLabels[sale.payment_method] || sale.payment_method}\n`;
    msg += '\nMerci pour votre achat!';
    return msg;
  };

  // ===================== RECEIPT SCREEN =====================
  if (completedSale) {
    const receiptMsg = generateReceiptMessage(completedSale);
    const custPhone = completedSale.customer?.phone || newCustomerPhone || '';

    return (
      <div className="min-h-screen bg-[#0F172A] text-white p-4">
        <div className="max-w-lg mx-auto">
          {/* Success header */}
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold">Vente confirm&eacute;e</h2>
            <p className="text-slate-400 text-sm mt-1">
              {formatDateTime(completedSale.created_at)}
            </p>
          </div>

          {/* Receipt card */}
          <div className="bg-slate-800 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-3">ARTICLES</h3>
            {completedSale.items?.map((item, i) => (
              <div
                key={i}
                className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0"
              >
                <div>
                  <p className="text-sm">
                    {item.product
                      ? `${item.product.brand} ${item.product.model}`
                      : 'Article'}
                  </p>
                  <p className="text-xs text-slate-400">x{item.quantity}</p>
                </div>
                <p className="text-sm font-medium">
                  {formatPrice(item.unit_price * item.quantity)}
                </p>
              </div>
            ))}

            <div className="border-t border-slate-600 mt-3 pt-3 space-y-1">
              {completedSale.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-yellow-400">
                  <span>Remise</span>
                  <span>-{formatPrice(completedSale.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatPrice(completedSale.total)}</span>
              </div>
            </div>

            {completedSale.customer && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-400">Client</p>
                <p className="text-sm">
                  {completedSale.customer.name} - {completedSale.customer.phone}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {/* Thermal print button */}
            <ThermalPrintButton
              receiptData={receiptESCPOS}
              fallbackHTML={receiptHTML}
              label="Imprimer le re\u00e7u"
            />

            {/* Receipt preview button */}
            <button
              onClick={() => setShowReceiptPreview(true)}
              className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Aper&ccedil;u re&ccedil;u
            </button>

            {/* WhatsApp share */}
            {custPhone && (
              <a
                href={generateWhatsAppLink(custPhone, receiptMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.75.75 0 00.917.918l4.458-1.495A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.37 0-4.567-.7-6.412-1.9l-.45-.3-3.15 1.055 1.055-3.15-.3-.45A9.935 9.935 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                </svg>
                Partager WhatsApp
              </a>
            )}

            <button
              onClick={resetForm}
              className="w-full bg-[#2AA8DC] hover:bg-[#2596c4] text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Nouvelle vente
            </button>
          </div>
        </div>

        {/* Receipt preview modal */}
        {showReceiptPreview && receiptHTML && (
          <ReceiptPreview
            html={receiptHTML}
            onPrintBrowser={() => {
              const printWindow = window.open('', '_blank');
              if (printWindow) {
                printWindow.document.write(receiptHTML);
                printWindow.document.close();
                printWindow.print();
              }
            }}
            onShare={custPhone ? () => {
              window.open(generateWhatsAppLink(custPhone, receiptMsg), '_blank');
            } : undefined}
          />
        )}
      </div>
    );
  }

  // ===================== MAIN POS SCREEN =====================
  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      {/* Offline badge */}
      {(isOffline || offlineCount > 0) && (
        <div className="bg-orange-500 text-white text-center text-sm py-1.5 font-medium">
          {isOffline
            ? 'Hors ligne \u2014 Les ventes seront synchronis\u00e9es automatiquement'
            : `${offlineCount} vente(s) en attente de synchronisation`}
        </div>
      )}

      {/* Top bar with navigation */}
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

        {/* Search */}
        <div className="relative mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                placeholder="Rechercher par mod&#232;le, marque ou IMEI..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent"
              />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            </div>
            <IMEIScanner onScan={(imei) => setSearchQuery(imei)} />
          </div>

          {/* Search results dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto">
              {searchResults.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="w-full text-left p-3 hover:bg-slate-700 border-b border-slate-700 last:border-0 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">
                        {product.brand} {product.model}
                        {product.storage ? ` ${product.storage}` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-400">
                          {conditionLabels[product.condition] || product.condition}
                          {product.imei ? ` \u2014 IMEI: ${product.imei}` : ''}
                        </p>
                        {product.bin_location && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-medium">
                            <span>{'\uD83D\uDCCD'}</span> {product.bin_location}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-[#2AA8DC]">
                      {formatPrice(product.selling_price)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showResults && searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
            <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl p-3">
              <p className="text-sm text-slate-400 text-center">Aucun produit trouv&eacute;</p>
            </div>
          )}
        </div>

        {/* Manual accessory entry */}
        <button
          onClick={() => setShowManualEntry(!showManualEntry)}
          className="text-sm text-[#2AA8DC] hover:text-[#2596c4] mb-3 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter un accessoire manuellement
        </button>

        {showManualEntry && (
          <div className="bg-slate-800 rounded-xl p-3 mb-4 space-y-2">
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Nom de l&#39;accessoire"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
            />
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder="Prix (MAD)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
              />
              <button
                onClick={addManualAccessory}
                className="bg-[#2AA8DC] hover:bg-[#2596c4] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Ajouter
              </button>
            </div>
          </div>
        )}

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
                    onClick={() => removeFromCart(index)}
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
                        onClick={() => updateItemQuantity(index, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateItemQuantity(index, item.quantity + 1)}
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
                      onChange={(e) => updateItemPrice(index, e.target.value)}
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

        {/* Discount */}
        {cart.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-3 mb-4">
            <p className="text-xs font-semibold text-slate-400 mb-2">REMISE</p>
            <div className="flex gap-2">
              <div className="flex bg-slate-900 rounded-lg p-0.5 flex-shrink-0">
                <button
                  onClick={() => setDiscountType('flat')}
                  className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                    discountType === 'flat' ? 'bg-[#2AA8DC] text-white' : 'text-slate-400'
                  }`}
                >
                  MAD
                </button>
                <button
                  onClick={() => setDiscountType('percentage')}
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
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'flat' ? 'Montant' : 'Pourcentage'}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
              />
            </div>
          </div>
        )}

        {/* Customer */}
        {cart.length > 0 && (
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
                    {/* Loyalty points badge */}
                    {loyaltyPoints > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-yellow-900/50 text-yellow-300 border border-yellow-700 px-2 py-0.5 rounded-full font-medium">
                        {'\u2B50'} {loyaltyPoints} pts
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
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
                        onClick={handleLoyaltyRedeem}
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
                        onClick={() => setLoyaltyRedeemAmount(0)}
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
                  onChange={(e) => { setCustomerSearch(e.target.value); setShowNewCustomer(false); }}
                  placeholder="Rechercher par t&#233;l&#233;phone..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC] mb-2"
                />

                {customerResults.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomerResults([]); }}
                        className="w-full text-left p-2 bg-slate-900 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                      >
                        {c.name} &mdash; {c.phone}
                      </button>
                    ))}
                  </div>
                )}

                {!showNewCustomer ? (
                  <button
                    onClick={() => setShowNewCustomer(true)}
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
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Nom du client"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
                    />
                    <input
                      type="tel"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="T&#233;l&#233;phone"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Payment method */}
        {cart.length > 0 && (
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
                  onClick={() => {
                    setPaymentMethod(key);
                    // Auto-fill store credit amount when selecting Avoir
                    if (key === 'store_credit') {
                      const remaining = Math.max(0, totalAfterGiftCard);
                      setStoreCreditAmount(Math.min(customerStoreCredit, remaining));
                    } else {
                      setStoreCreditAmount(0);
                    }
                  }}
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
                    onChange={(e) => setMixteAmounts({ ...mixteAmounts, cash: e.target.value })}
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
                    onChange={(e) => setMixteAmounts({ ...mixteAmounts, card: e.target.value })}
                    placeholder="0"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
                  />
                </div>
              </div>
            )}

            {/* Gift card input */}
            {paymentMethod === 'gift_card' && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <GiftCardInput onRedeem={handleGiftCardRedeem} />
                {giftCardAmount > 0 && (
                  <div className="flex items-center justify-between mt-2 bg-green-900/30 border border-green-800 rounded-lg px-3 py-2">
                    <p className="text-xs text-green-400 font-medium">
                      Carte cadeau : -{formatPrice(giftCardAmount)}
                    </p>
                    <button
                      onClick={() => {
                        setGiftCardCode('');
                        setGiftCardBalance(0);
                        setGiftCardAmount(0);
                      }}
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
                      setStoreCreditAmount(Math.min(val, customerStoreCredit, totalAfterGiftCard));
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
        )}
      </div>

      {/* Bottom fixed: Totals + Confirm */}
      {cart.length > 0 && (
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
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0}
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
      )}
    </div>
  );
}
