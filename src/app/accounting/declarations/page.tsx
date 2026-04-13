'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';

interface VATDeclaration {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  vat_collected: number;
  vat_deductible: number;
  vat_due: number;
  status: 'draft' | 'submitted' | 'paid';
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Brouillon', bg: 'bg-gray-100 dark:bg-slate-700', text: 'text-gray-600 dark:text-gray-300' },
  submitted: { label: 'Soumise', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
  paid: { label: 'Payee', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-[#5BBF3E]' },
};

type PeriodType = 'month' | 'quarter';

export default function DeclarationsPage() {
  const { user } = useAuth();
  const [periodType, setPeriodType] = useState<PeriodType>('quarter');
  const [year, setYear] = useState(new Date().getFullYear());
  const [declarations, setDeclarations] = useState<VATDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ period_type: periodType, year: String(year) });
        const res = await fetch(`/api/accounting/declarations?${params}`);
        if (res.ok) {
          const data = await res.json();
          setDeclarations(data.declarations || []);
        } else {
          setDeclarations([]);
        }
      } catch {
        setDeclarations([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, periodType, year]);

  async function handleGenerate(periodStart: string, periodEnd: string, periodLabel: string) {
    setGenerating(periodLabel);
    try {
      const res = await fetch('/api/accounting/declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_start: periodStart, period_end: periodEnd, period_label: periodLabel }),
      });
      if (res.ok) {
        const data = await res.json();
        setDeclarations((prev) => {
          const exists = prev.findIndex((d) => d.period_label === periodLabel);
          if (exists >= 0) {
            const updated = [...prev];
            updated[exists] = data.declaration;
            return updated;
          }
          return [...prev, data.declaration];
        });
      }
    } catch { /* ignore */ }
    finally { setGenerating(null); }
  }

  if (!user) return null;

  // Summary totals
  const totalCollected = declarations.reduce((s, d) => s + d.vat_collected, 0);
  const totalDeductible = declarations.reduce((s, d) => s + d.vat_deductible, 0);
  const totalDue = declarations.reduce((s, d) => s + d.vat_due, 0);

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">D&eacute;clarations TVA</h1>

      {/* Period Type Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setPeriodType('quarter')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
            periodType === 'quarter'
              ? 'bg-[#2AA8DC] text-white'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          Trimestriel
        </button>
        <button
          onClick={() => setPeriodType('month')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
            periodType === 'month'
              ? 'bg-[#2AA8DC] text-white'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          Mensuel
        </button>
      </div>

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

      {/* Summary */}
      {!loading && declarations.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 text-center border border-gray-100 dark:border-slate-700">
            <p className="text-sm font-bold text-[#2AA8DC]">{formatPrice(totalCollected)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Collect&eacute;e</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 text-center border border-gray-100 dark:border-slate-700">
            <p className="text-sm font-bold text-[#5BBF3E]">{formatPrice(totalDeductible)}</p>
            <p className="text-xs text-gray-400 mt-0.5">D&eacute;ductible</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 text-center border border-gray-100 dark:border-slate-700">
            <p className="text-sm font-bold text-orange-500">{formatPrice(totalDue)}</p>
            <p className="text-xs text-gray-400 mt-0.5">&Agrave; payer</p>
          </div>
        </div>
      )}

      {/* Declarations List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : declarations.length === 0 ? (
        <p className="text-center text-gray-400 py-12">Aucune d&eacute;claration pour {year}</p>
      ) : (
        <div className="space-y-3">
          {declarations.map((decl) => {
            const status = statusConfig[decl.status] || statusConfig.draft;
            return (
              <div key={decl.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{decl.period_label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-400">Collect&eacute;e</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{formatPrice(decl.vat_collected)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">D&eacute;ductible</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{formatPrice(decl.vat_deductible)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">&Agrave; payer</p>
                    <p className="text-sm font-bold text-orange-500">{formatPrice(decl.vat_due)}</p>
                  </div>
                </div>

                {decl.status === 'draft' && (
                  <button
                    onClick={() => handleGenerate(decl.period_start, decl.period_end, decl.period_label)}
                    disabled={generating === decl.period_label}
                    className="w-full py-2 bg-[#2AA8DC]/10 text-[#2AA8DC] text-sm font-medium rounded-lg disabled:opacity-50 transition"
                  >
                    {generating === decl.period_label ? 'Mise a jour...' : 'Mettre a jour'}
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
