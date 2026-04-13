'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Sale } from '@/types';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatDateTime, generateWhatsAppLink } from '@/lib/utils';

// Stores loaded dynamically

const paymentLabels: Record<string, string> = {
  cash: 'Especes',
  card: 'Carte',
  virement: 'Virement',
  mixte: 'Mixte',
};

function todayString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function SalesPage() {
  const { user, selectedStoreId } = useAuth();
  const [stores, setStores] = useState<{id: string, name: string}[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(todayString());
  const [dateTo, setDateTo] = useState(todayString());
  const [storeFilter, setStoreFilter] = useState(selectedStoreId || '');

  const fetchSales = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from('sales')
        .select('*, seller:users!sales_seller_id_fkey(id, name), customer:customers(id, name, phone), items:sale_items(id, sale_id, product_id, quantity, unit_price, original_price, product:products(id, brand, model, imei))')
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false });

      if (user.role === 'superadmin' && storeFilter) {
        query = query.eq('store_id', storeFilter);
      } else if (user.role !== 'superadmin') {
        query = query.eq('store_id', user.store_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching sales:', error);
        setSales([]);
      } else {
        setSales((data as Sale[]) || []);
      }
    } catch {
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [user, dateFrom, dateTo, storeFilter]);

  useEffect(() => {
    fetchSales();
    fetch('/api/stores').then(r => r.json()).then(data => {
      if (data.stores) setStores(data.stores.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    }).catch(() => {});
  }, [fetchSales]);

  const buildReceiptText = (sale: Sale): string => {
    const lines: string[] = [
      '--- CORNER MOBILE ---',
      `Date: ${formatDateTime(sale.created_at)}`,
      sale.seller?.name ? `Vendeur: ${sale.seller.name}` : '',
      sale.customer?.name ? `Client: ${sale.customer.name}` : '',
      '',
      'Articles:',
    ];

    sale.items?.forEach((item) => {
      const name = item.product ? `${item.product.brand} ${item.product.model}` : 'Produit';
      lines.push(`  ${name} x${item.quantity} - ${formatPrice(item.unit_price)}`);
      if (item.original_price > item.unit_price) {
        lines.push(`    (prix original: ${formatPrice(item.original_price)})`);
      }
    });

    if (sale.discount_amount > 0) {
      lines.push('');
      lines.push(`Remise: -${formatPrice(sale.discount_amount)}`);
    }

    lines.push('');
    lines.push(`TOTAL: ${formatPrice(sale.total)}`);
    lines.push(`Paiement: ${paymentLabels[sale.payment_method] || sale.payment_method}`);
    lines.push('');
    lines.push('Merci pour votre achat !');

    return lines.filter((l) => l !== undefined).join('\n');
  };

  const handlePrint = (sale: Sale) => {
    const receiptText = buildReceiptText(sale);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head><title>Recu</title>
        <style>
          body { font-family: monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 20px; }
          pre { white-space: pre-wrap; }
        </style>
        </head>
        <body><pre>${receiptText}</pre>
        <script>window.onload=function(){window.print();}</script>
        </body></html>
      `);
      printWindow.document.close();
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 pb-24">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Historique des ventes</h1>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 mb-4 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
            />
          </div>
        </div>

        {user.role === 'superadmin' && (
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
          >
            <option value="">Tous les magasins</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Summary */}
      {!loading && (
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-[#2AA8DC]/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-[#2AA8DC]">{sales.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ventes</p>
          </div>
          <div className="flex-1 bg-green-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{formatPrice(sales.reduce((s, v) => s + v.total, 0))}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          </div>
        </div>
      )}

      {/* Sales List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sales.length === 0 ? (
        <p className="text-center text-gray-400 py-12">Aucune vente pour cette periode</p>
      ) : (
        <div className="space-y-2">
          {sales.map((sale) => {
            const isExpanded = expandedId === sale.id;
            const itemsCount = sale.items?.reduce((s, i) => s + i.quantity, 0) || 0;

            return (
              <div key={sale.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                {/* Sale header — tap to expand */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : sale.id)}
                  className="w-full p-3 text-start"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatDateTime(sale.created_at)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {itemsCount} article{itemsCount > 1 ? 's' : ''} &middot; {paymentLabels[sale.payment_method] || sale.payment_method}
                      </p>
                      {sale.customer?.name && (
                        <p className="text-xs text-gray-400">Client: {sale.customer.name}</p>
                      )}
                      {sale.seller?.name && (
                        <p className="text-xs text-gray-400">Vendeur: {sale.seller.name}</p>
                      )}
                    </div>
                    <div className="text-end flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{formatPrice(sale.total)}</span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700 p-3 space-y-2">
                    {/* Items */}
                    <div className="space-y-1">
                      {sale.items?.map((item) => {
                        const name = item.product
                          ? `${item.product.brand} ${item.product.model}`
                          : 'Produit';
                        return (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <div>
                              <p className="text-gray-800 dark:text-gray-100">{name} <span className="text-gray-400">x{item.quantity}</span></p>
                              {item.original_price > item.unit_price && (
                                <p className="text-xs text-red-400 line-through">{formatPrice(item.original_price)}</p>
                              )}
                            </div>
                            <span className="font-medium">{formatPrice(item.unit_price * item.quantity)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {sale.discount_amount > 0 && (
                      <p className="text-sm text-red-500">Remise: -{formatPrice(sale.discount_amount)}</p>
                    )}

                    {/* Warranty badge */}
                    {sale.items?.some((item) => item.product && (item.product.warranty_months ?? 0) > 0) && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-medium">
                          Garantie incluse
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      {sale.customer?.phone && (
                        <a
                          href={generateWhatsAppLink(sale.customer.phone, buildReceiptText(sale))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 text-center text-sm font-medium bg-green-500 text-white rounded-lg"
                        >
                          Partager
                        </a>
                      )}
                      <button
                        onClick={() => handlePrint(sale)}
                        className="flex-1 py-2 text-center text-sm font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg"
                      >
                        Imprimer
                      </button>
                      <a
                        href={`/returns/new?sale_id=${sale.id}`}
                        className="flex-1 py-2 text-center text-sm font-medium bg-red-50 text-red-600 rounded-lg border border-red-200"
                      >
                        Retour
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
