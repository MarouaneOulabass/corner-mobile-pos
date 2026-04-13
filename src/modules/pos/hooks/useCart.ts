'use client';

import { useState } from 'react';
import type { Product, CartItem } from '@/types';

export function useCart(storeId: string, userId: string) {
  const [cart, setCart] = useState<CartItem[]>([]);

  // --- Manual entry state ---
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');

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
      store_id: storeId,
      created_by: userId,
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

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  const hasPriceBelowCost = cart.some(
    (i) => i.unit_price < i.product.purchase_price && i.product.purchase_price > 0
  );

  return {
    cart,
    subtotal,
    hasPriceBelowCost,
    addToCart,
    addManualAccessory,
    updateItemPrice,
    updateItemQuantity,
    removeFromCart,
    clearCart,
    showManualEntry,
    setShowManualEntry,
    manualName,
    setManualName,
    manualPrice,
    setManualPrice,
  };
}
