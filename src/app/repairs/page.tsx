'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Repair } from '@/types';
import {
  formatPrice,
  formatDate,
  repairStatusLabels,
  repairStatusColors,
} from '@/lib/utils';

const statusTabs: { key: string; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'received', label: 'Reçu' },
  { key: 'diagnosing', label: 'Diagnostic' },
  { key: 'waiting_parts', label: 'Attente pièces' },
  { key: 'in_repair', label: 'En réparation' },
  { key: 'ready', label: 'Prêt' },
];

export default function RepairsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchRepairs = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const params = new URLSearchParams();
    if (activeTab !== 'all') params.set('status', activeTab);
    if (searchDebounced) params.set('search', searchDebounced);

    try {
      const res = await fetch(`/api/repairs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRepairs(data.repairs || []);
      }
    } catch {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [user, activeTab, searchDebounced]);

  useEffect(() => {
    fetchRepairs();
  }, [fetchRepairs]);

  function isOverdue(repair: Repair): boolean {
    if (!repair.estimated_completion_date) return false;
    if (repair.status === 'delivered' || repair.status === 'cancelled') return false;
    return new Date(repair.estimated_completion_date) < new Date();
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Réparations</h1>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error} <button onClick={() => { setError(null); fetchRepairs(); }} className="ms-2 underline">Réessayer</button></div>}

      {/* Search */}
      <input
        type="text"
        placeholder="Rechercher client, téléphone, appareil..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
      />

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-[#2AA8DC] text-white'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Refresh button */}
      <button onClick={() => fetchRepairs()} className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#2AA8DC] mb-2">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Actualiser
      </button>

      {/* Repair cards */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : repairs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">Aucune réparation trouvée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {repairs.map((repair) => (
            <button
              key={repair.id}
              onClick={() => router.push(`/repairs/${repair.id}`)}
              className={`w-full text-start bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border transition-colors ${
                isOverdue(repair)
                  ? 'border-red-300 bg-red-50/50'
                  : 'border-gray-100 dark:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                    {repair.device_brand} {repair.device_model}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {repair.customer?.name || 'Client inconnu'}
                    {repair.customer?.phone ? ` - ${repair.customer.phone}` : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-white ${
                    repairStatusColors[repair.status] || 'bg-gray-400'
                  }`}
                >
                  {repairStatusLabels[repair.status] || repair.status}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">
                  {formatPrice(repair.estimated_cost)}
                </span>
                {repair.estimated_completion_date && (
                  <span
                    className={`text-xs ${
                      isOverdue(repair) ? 'text-red-500 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {isOverdue(repair) ? 'En retard - ' : ''}
                    {formatDate(repair.estimated_completion_date)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => router.push('/repairs/new')}
        className="fixed bottom-24 end-4 w-14 h-14 bg-[#2AA8DC] text-white rounded-full shadow-lg flex items-center justify-center text-2xl font-light hover:bg-[#2590c0] active:scale-95 transition-all z-30"
      >
        +
      </button>
    </div>
  );
}
