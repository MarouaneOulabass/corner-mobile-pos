'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Return } from '@/types';
import { formatPrice, formatDateTime, returnTypeLabels, refundMethodLabels } from '@/lib/utils';

function todayString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export default function ReturnsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo());
  const [dateTo, setDateTo] = useState(todayString());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchReturns = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/returns?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReturns(data.returns || []);
      } else {
        setReturns([]);
      }
    } catch {
      setReturns([]);
    } finally {
      setLoading(false);
    }
  }, [user, dateFrom, dateTo]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  if (!user) return null;

  const totalRefunds = returns.reduce((s, r) => s + r.refund_amount, 0);

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Retours</h1>
        <button
          onClick={() => router.push('/returns/new')}
          className="px-4 py-2 bg-[#2AA8DC] text-white text-sm font-medium rounded-xl"
        >
          + Nouveau retour
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 mb-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      {!loading && (
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{returns.length}</p>
            <p className="text-xs text-gray-500">Retours</p>
          </div>
          <div className="flex-1 bg-orange-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-orange-600">{formatPrice(totalRefunds)}</p>
            <p className="text-xs text-gray-500">Remboursements</p>
          </div>
        </div>
      )}

      {/* Returns List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : returns.length === 0 ? (
        <p className="text-center text-gray-400 py-12">Aucun retour pour cette periode</p>
      ) : (
        <div className="space-y-2">
          {returns.map((ret) => {
            const isExpanded = expandedId === ret.id;
            return (
              <div key={ret.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : ret.id)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDateTime(ret.created_at)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {returnTypeLabels[ret.return_type] || ret.return_type}
                        {' · '}
                        {refundMethodLabels[ret.refund_method] || ret.refund_method}
                      </p>
                      {ret.customer?.name && (
                        <p className="text-xs text-gray-400">Client: {ret.customer.name}</p>
                      )}
                      {ret.processor?.name && (
                        <p className="text-xs text-gray-400">Par: {ret.processor.name}</p>
                      )}
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-sm font-bold text-red-600">-{formatPrice(ret.refund_amount)}</span>
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

                {isExpanded && (
                  <div className="border-t border-gray-100 p-3 space-y-2">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Raison:</span> {ret.reason}
                    </p>
                    {ret.notes && (
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">Notes:</span> {ret.notes}
                      </p>
                    )}

                    {/* Items */}
                    {ret.items && ret.items.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <p className="text-xs font-medium text-gray-500 uppercase">Articles retournes</p>
                        {ret.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <span className="text-gray-800">
                              {item.product ? `${item.product.brand} ${item.product.model}` : 'Produit'}
                              {' '}
                              <span className="text-gray-400">x{item.quantity}</span>
                              {item.restocked && (
                                <span className="ml-1 text-xs bg-green-100 text-green-700 px-1 rounded">restocke</span>
                              )}
                            </span>
                            <span className="font-medium text-red-600">-{formatPrice(item.refund_amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sale reference */}
                    {ret.sale && (
                      <p className="text-xs text-gray-400 pt-1">
                        Vente #{ret.sale_id.slice(0, 8)} du {formatDateTime(ret.sale.created_at)} — Total: {formatPrice(ret.sale.total)}
                      </p>
                    )}
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
