'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface PeriodStatus {
  month: number;
  label: string;
  status: 'open' | 'closing' | 'closed';
  entry_count: number;
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: 'Ouvert', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-[#5BBF3E]' },
  closing: { label: 'En cours', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-500' },
  closed: { label: 'Cloture', bg: 'bg-gray-100 dark:bg-slate-700', text: 'text-gray-500 dark:text-gray-400' },
};

const monthNames = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

export default function ClosingsPage() {
  const { user } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [periods, setPeriods] = useState<PeriodStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingMonth, setClosingMonth] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/accounting/closings?year=${year}`);
        if (res.ok) {
          const data = await res.json();
          setPeriods(data.periods || []);
        } else {
          // Default: all months open
          setPeriods(monthNames.map((label, idx) => ({
            month: idx + 1,
            label,
            status: 'open' as const,
            entry_count: 0,
          })));
        }
      } catch {
        setPeriods(monthNames.map((label, idx) => ({
          month: idx + 1,
          label,
          status: 'open' as const,
          entry_count: 0,
        })));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, year]);

  async function handleClose(month: number) {
    if (!confirm(`Cloture le mois de ${monthNames[month - 1]} ${year} ? Cette action est irreversible.`)) return;
    setClosingMonth(month);
    try {
      const res = await fetch('/api/accounting/closings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      });
      if (res.ok) {
        setPeriods((prev) =>
          prev.map((p) => p.month === month ? { ...p, status: 'closed' } : p)
        );
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur lors de la cloture');
      }
    } catch {
      alert('Erreur de connexion');
    } finally {
      setClosingMonth(null);
    }
  }

  if (!user) return null;

  const closedCount = periods.filter((p) => p.status === 'closed').length;

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Clotures comptables</h1>

      {/* Year Selector */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setYear((y) => y - 1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-lg font-bold text-gray-900 dark:text-white">{year}</span>
        <button
          onClick={() => setYear((y) => y + 1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Progress */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Progression</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{closedCount}/12 mois</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#2AA8DC] rounded-full transition-all"
            style={{ width: `${(closedCount / 12) * 100}%` }}
          />
        </div>
      </div>

      {/* Month Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {periods.map((period) => {
            const config = statusConfig[period.status] || statusConfig.open;
            const canClose = period.status === 'open';
            const isClosing = closingMonth === period.month;

            return (
              <div
                key={period.month}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{period.label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{period.entry_count} ecritures</p>
                {canClose && (
                  <button
                    onClick={() => handleClose(period.month)}
                    disabled={isClosing}
                    className="w-full py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg disabled:opacity-50 transition"
                  >
                    {isClosing ? 'Cloture...' : 'Cloturer'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
