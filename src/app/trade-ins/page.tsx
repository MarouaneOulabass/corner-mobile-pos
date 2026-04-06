'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TradeIn, TradeInStatus } from '@/types';
import { formatPrice, formatDateTime, tradeInStatusLabels, tradeInStatusColors, conditionLabels } from '@/lib/utils';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: 'Tous' },
  { key: 'pending', label: 'En attente' },
  { key: 'accepted', label: 'Acceptes' },
  { key: 'in_refurbishment', label: 'Remise a neuf' },
  { key: 'listed', label: 'Mis en vente' },
];

export default function TradeInsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tradeIns, setTradeIns] = useState<TradeIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchTradeIns = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/trade-ins?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTradeIns(data.trade_ins || []);
      } else {
        setTradeIns([]);
      }
    } catch {
      setTradeIns([]);
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter, search]);

  useEffect(() => {
    fetchTradeIns();
  }, [fetchTradeIns]);

  const handleStatusChange = async (tradeIn: TradeIn, newStatus: TradeInStatus) => {
    try {
      const res = await fetch(`/api/trade-ins/${tradeIn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchTradeIns();
      }
    } catch {
      // Silently fail
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Rachats</h1>
        <button
          onClick={() => router.push('/trade-ins/new')}
          className="px-4 py-2 bg-[#2AA8DC] text-white text-sm font-medium rounded-xl"
        >
          + Nouveau rachat
        </button>
      </div>

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="Rechercher (marque, modele, IMEI)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap ${
              statusFilter === tab.key
                ? 'bg-[#2AA8DC] text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      {!loading && (
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-[#2AA8DC]/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-[#2AA8DC]">{tradeIns.length}</p>
            <p className="text-xs text-gray-500">Rachats</p>
          </div>
          <div className="flex-1 bg-green-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-600">
              {formatPrice(tradeIns.reduce((s, t) => s + t.offered_price, 0))}
            </p>
            <p className="text-xs text-gray-500">Valeur totale</p>
          </div>
        </div>
      )}

      {/* Trade-ins List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tradeIns.length === 0 ? (
        <p className="text-center text-gray-400 py-12">Aucun rachat trouve</p>
      ) : (
        <div className="space-y-2">
          {tradeIns.map((tradeIn) => {
            const isExpanded = expandedId === tradeIn.id;
            return (
              <div key={tradeIn.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : tradeIn.id)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {tradeIn.device_brand} {tradeIn.device_model}
                        </p>
                        <span className={`px-2 py-0.5 text-xs text-white rounded-full ${tradeInStatusColors[tradeIn.status] || 'bg-gray-500'}`}>
                          {tradeInStatusLabels[tradeIn.status] || tradeIn.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(tradeIn.created_at)}
                        {tradeIn.storage && ` · ${tradeIn.storage}`}
                        {tradeIn.condition && ` · ${conditionLabels[tradeIn.condition] || tradeIn.condition}`}
                      </p>
                      {tradeIn.customer?.name && (
                        <p className="text-xs text-gray-400">Client: {tradeIn.customer.name}</p>
                      )}
                    </div>
                    <div className="text-right flex items-center gap-2 ml-2">
                      <span className="text-sm font-bold text-gray-900">{formatPrice(tradeIn.offered_price)}</span>
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
                  <div className="border-t border-gray-100 p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {tradeIn.imei && (
                        <div>
                          <p className="text-xs text-gray-400">IMEI</p>
                          <p className="text-gray-700 font-mono text-xs">{tradeIn.imei}</p>
                        </div>
                      )}
                      {tradeIn.color && (
                        <div>
                          <p className="text-xs text-gray-400">Couleur</p>
                          <p className="text-gray-700">{tradeIn.color}</p>
                        </div>
                      )}
                      {tradeIn.ai_suggested_price != null && (
                        <div>
                          <p className="text-xs text-gray-400">Prix suggere IA</p>
                          <p className="text-gray-700">{formatPrice(tradeIn.ai_suggested_price)}</p>
                        </div>
                      )}
                      {tradeIn.processor?.name && (
                        <div>
                          <p className="text-xs text-gray-400">Traite par</p>
                          <p className="text-gray-700">{tradeIn.processor.name}</p>
                        </div>
                      )}
                    </div>

                    {tradeIn.notes && (
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">Notes:</span> {tradeIn.notes}
                      </p>
                    )}

                    {/* Action buttons based on status */}
                    <div className="flex gap-2 pt-1">
                      {tradeIn.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(tradeIn, 'accepted')}
                            className="flex-1 py-2 text-sm font-medium bg-green-500 text-white rounded-lg"
                          >
                            Accepter
                          </button>
                          <button
                            onClick={() => handleStatusChange(tradeIn, 'rejected')}
                            className="flex-1 py-2 text-sm font-medium bg-red-500 text-white rounded-lg"
                          >
                            Refuser
                          </button>
                        </>
                      )}
                      {tradeIn.status === 'accepted' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(tradeIn, 'in_refurbishment')}
                            className="flex-1 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg"
                          >
                            Remise a neuf
                          </button>
                          <button
                            onClick={() => handleStatusChange(tradeIn, 'listed')}
                            className="flex-1 py-2 text-sm font-medium bg-green-500 text-white rounded-lg"
                          >
                            Mettre en vente
                          </button>
                        </>
                      )}
                      {tradeIn.status === 'in_refurbishment' && (
                        <button
                          onClick={() => handleStatusChange(tradeIn, 'listed')}
                          className="flex-1 py-2 text-sm font-medium bg-green-500 text-white rounded-lg"
                        >
                          Mettre en vente
                        </button>
                      )}
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
