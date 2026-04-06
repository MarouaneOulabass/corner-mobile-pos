'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sale, SaleItem } from '@/types';
import { formatPrice, formatDateTime, returnTypeLabels, returnReasonLabels, refundMethodLabels } from '@/lib/utils';

interface ReturnItemSelection {
  sale_item: SaleItem;
  selected: boolean;
  quantity: number;
  refund_amount: number;
  restocked: boolean;
}

type Step = 'search' | 'select_items' | 'details' | 'review';

export default function NewReturnPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('search');

  // Step 1: Search
  const [saleSearch, setSaleSearch] = useState('');
  const [sale, setSale] = useState<Sale | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Step 2: Items selection
  const [returnItems, setReturnItems] = useState<ReturnItemSelection[]>([]);

  // Step 3: Details
  const [returnType, setReturnType] = useState<string>('full');
  const [reason, setReason] = useState('');
  const [reasonCategory, setReasonCategory] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // --- STEP 1: Search sale ---
  const searchSale = useCallback(async () => {
    if (!saleSearch.trim()) return;
    setSearchLoading(true);
    setSearchError('');

    try {
      // Search by sale ID (partial match on the UUID)
      const res = await fetch(`/api/sales?limit=10`);
      if (!res.ok) {
        setSearchError('Erreur de recherche');
        return;
      }
      const data = await res.json();
      const sales = data.sales || [];

      // Find matching sale by ID prefix
      const match = sales.find((s: Sale) =>
        s.id.toLowerCase().startsWith(saleSearch.toLowerCase()) ||
        s.id.toLowerCase().includes(saleSearch.toLowerCase())
      );

      if (match) {
        setSale(match);
        // Initialize return items from sale items
        const items: ReturnItemSelection[] = (match.items || []).map((si: SaleItem) => ({
          sale_item: si,
          selected: false,
          quantity: si.quantity,
          refund_amount: si.unit_price * si.quantity,
          restocked: si.product?.product_type === 'phone',
        }));
        setReturnItems(items);
        setStep('select_items');
      } else {
        setSearchError('Vente introuvable. Verifiez le numero de vente.');
      }
    } catch {
      setSearchError('Erreur de connexion');
    } finally {
      setSearchLoading(false);
    }
  }, [saleSearch]);

  // --- STEP 2: Toggle item selection ---
  const toggleItem = (index: number) => {
    setReturnItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], selected: !updated[index].selected };
      return updated;
    });
  };

  const updateItemQuantity = (index: number, qty: number) => {
    setReturnItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const maxQty = item.sale_item.quantity;
      const newQty = Math.max(1, Math.min(qty, maxQty));
      updated[index] = {
        ...item,
        quantity: newQty,
        refund_amount: item.sale_item.unit_price * newQty,
      };
      return updated;
    });
  };

  const toggleRestock = (index: number) => {
    setReturnItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], restocked: !updated[index].restocked };
      return updated;
    });
  };

  const selectedItems = returnItems.filter((i) => i.selected);
  const totalRefund = selectedItems.reduce((s, i) => s + i.refund_amount, 0);

  // --- STEP 4: Submit ---
  const handleSubmit = async () => {
    if (selectedItems.length === 0 || !sale) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        sale_id: sale.id,
        return_type: returnType,
        reason,
        reason_category: reasonCategory || undefined,
        refund_method: refundMethod,
        notes: notes || undefined,
        items: selectedItems.map((i) => ({
          product_id: i.sale_item.product_id,
          sale_item_id: i.sale_item.id,
          quantity: i.quantity,
          refund_amount: i.refund_amount,
          restocked: i.restocked,
        })),
      };

      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push('/returns');
      } else {
        const data = await res.json();
        setSubmitError(data.error || 'Erreur lors du retour');
      }
    } catch {
      setSubmitError('Erreur de connexion');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Nouveau retour</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6">
        {(['search', 'select_items', 'details', 'review'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`h-1 flex-1 rounded-full ${
                (['search', 'select_items', 'details', 'review'] as Step[]).indexOf(step) >= i
                  ? 'bg-[#2AA8DC]'
                  : 'bg-gray-200 dark:bg-slate-600'
              }`}
            />
          </div>
        ))}
      </div>

      {/* STEP 1: Search Sale */}
      {step === 'search' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Rechercher la vente</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Numero de vente (ex: a1b2c3...)"
                value={saleSearch}
                onChange={(e) => setSaleSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchSale()}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
              />
              <button
                onClick={searchSale}
                disabled={searchLoading || !saleSearch.trim()}
                className="px-4 py-2 bg-[#2AA8DC] text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {searchLoading ? '...' : 'Chercher'}
              </button>
            </div>
            {searchError && (
              <p className="text-sm text-red-500 mt-2">{searchError}</p>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: Select Items */}
      {step === 'select_items' && sale && (
        <div className="space-y-4">
          {/* Sale info */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Vente trouvee</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Date: {formatDateTime(sale.created_at)}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Total: {formatPrice(sale.total)}</p>
            {sale.customer?.name && (
              <p className="text-sm text-gray-600 dark:text-gray-300">Client: {sale.customer.name}</p>
            )}
            {sale.seller?.name && (
              <p className="text-sm text-gray-600 dark:text-gray-300">Vendeur: {sale.seller.name}</p>
            )}
          </div>

          {/* Items */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Selectionnez les articles a retourner</h2>
            <div className="space-y-3">
              {returnItems.map((item, index) => {
                const product = item.sale_item.product;
                const productName = product ? `${product.brand} ${product.model}` : 'Produit';
                return (
                  <div
                    key={item.sale_item.id}
                    className={`p-3 rounded-lg border ${item.selected ? 'border-[#2AA8DC] bg-blue-50' : 'border-gray-200 dark:border-slate-600'}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleItem(index)}
                        className="w-5 h-5 text-[#2AA8DC] rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{productName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Prix: {formatPrice(item.sale_item.unit_price)} x {item.sale_item.quantity}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {formatPrice(item.sale_item.unit_price * item.sale_item.quantity)}
                      </span>
                    </div>

                    {/* Expanded options when selected */}
                    {item.selected && (
                      <div className="mt-3 pl-8 space-y-2">
                        {/* Quantity (for accessories with qty > 1) */}
                        {item.sale_item.quantity > 1 && (
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-500 dark:text-gray-400">Qte a retourner:</label>
                            <input
                              type="number"
                              min={1}
                              max={item.sale_item.quantity}
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(index, parseInt(e.target.value, 10))}
                              className="w-16 px-2 py-1 border border-gray-200 dark:border-slate-600 rounded text-sm text-center"
                            />
                            <span className="text-xs text-gray-400">/ {item.sale_item.quantity}</span>
                          </div>
                        )}

                        {/* Restock toggle */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.restocked}
                            onChange={() => toggleRestock(index)}
                            className="w-4 h-4 text-green-600 rounded"
                          />
                          <label className="text-xs text-gray-600 dark:text-gray-300">Remettre en stock</label>
                        </div>

                        <p className="text-xs text-[#2AA8DC] font-medium">
                          Remboursement: {formatPrice(item.refund_amount)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total */}
          {selectedItems.length > 0 && (
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total remboursement</p>
              <p className="text-xl font-bold text-red-600">{formatPrice(totalRefund)}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setStep('search'); setSale(null); }}
              className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-xl"
            >
              Retour
            </button>
            <button
              onClick={() => setStep('details')}
              disabled={selectedItems.length === 0}
              className="flex-1 py-3 bg-[#2AA8DC] text-white text-sm font-medium rounded-xl disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Details */}
      {step === 'details' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 space-y-4">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200">Details du retour</h2>

            {/* Return type */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Type de retour</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(returnTypeLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setReturnType(key)}
                    className={`py-2 text-xs font-medium rounded-lg border ${
                      returnType === key
                        ? 'border-[#2AA8DC] bg-[#2AA8DC]/10 text-[#2AA8DC]'
                        : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason category */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Categorie</label>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
              >
                <option value="">Selectionnez...</option>
                {Object.entries(returnReasonLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Reason text */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Raison *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Decrivez la raison du retour..."
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm resize-none"
              />
            </div>

            {/* Refund method */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Methode de remboursement</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(refundMethodLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setRefundMethod(key)}
                    className={`py-2 text-xs font-medium rounded-lg border ${
                      refundMethod === key
                        ? 'border-[#2AA8DC] bg-[#2AA8DC]/10 text-[#2AA8DC]'
                        : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notes supplementaires..."
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep('select_items')}
              className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-xl"
            >
              Retour
            </button>
            <button
              onClick={() => setStep('review')}
              disabled={!reason.trim()}
              className="flex-1 py-3 bg-[#2AA8DC] text-white text-sm font-medium rounded-xl disabled:opacity-50"
            >
              Verifier
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Review & Confirm */}
      {step === 'review' && sale && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 space-y-3">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200">Resume du retour</h2>

            <div className="space-y-1 text-sm">
              <p className="text-gray-600 dark:text-gray-300">
                <span className="font-medium">Vente:</span> #{sale.id.slice(0, 8)} du {formatDateTime(sale.created_at)}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                <span className="font-medium">Type:</span> {returnTypeLabels[returnType] || returnType}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                <span className="font-medium">Raison:</span> {reason}
              </p>
              {reasonCategory && (
                <p className="text-gray-600 dark:text-gray-300">
                  <span className="font-medium">Categorie:</span> {returnReasonLabels[reasonCategory] || reasonCategory}
                </p>
              )}
              <p className="text-gray-600 dark:text-gray-300">
                <span className="font-medium">Remboursement via:</span> {refundMethodLabels[refundMethod] || refundMethod}
              </p>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-700 pt-2 space-y-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Articles</p>
              {selectedItems.map((item) => {
                const product = item.sale_item.product;
                const productName = product ? `${product.brand} ${product.model}` : 'Produit';
                return (
                  <div key={item.sale_item.id} className="flex justify-between text-sm">
                    <span className="text-gray-800 dark:text-gray-100">
                      {productName} x{item.quantity}
                      {item.restocked && <span className="text-xs text-green-600 ml-1">(restocke)</span>}
                    </span>
                    <span className="text-red-600 font-medium">-{formatPrice(item.refund_amount)}</span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-100 dark:border-slate-700 pt-2">
              <div className="flex justify-between text-base font-bold">
                <span>Total remboursement</span>
                <span className="text-red-600">-{formatPrice(totalRefund)}</span>
              </div>
            </div>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setStep('details')}
              className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-xl"
            >
              Modifier
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 bg-red-600 text-white text-sm font-medium rounded-xl disabled:opacity-50"
            >
              {submitting ? 'Traitement...' : 'Confirmer le retour'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
