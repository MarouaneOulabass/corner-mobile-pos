'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice, formatDate } from '@/lib/utils';

interface AccountingKPIs {
  revenue: number;
  vatDue: number;
  receivables: number;
  cashBalance: number;
}

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  journal_code: string;
  label: string;
  total_debit: number;
  total_credit: number;
}

const quickLinks = [
  { title: 'Journaux', href: '/accounting/journals', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { title: 'Grand Livre', href: '/accounting/ledger', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { title: 'Balance', href: '/accounting/balance', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
  { title: 'Factures', href: '/accounting/invoices', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
  { title: 'TVA', href: '/accounting/declarations', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { title: 'Exports', href: '/accounting/exports', icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

export default function AccountingDashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<AccountingKPIs>({ revenue: 0, vatDue: 0, receivables: 0, cashBalance: 0 });
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      try {
        const [kpiRes, entriesRes] = await Promise.all([
          fetch('/api/accounting/kpis'),
          fetch('/api/accounting/journal-entries?limit=10'),
        ]);
        if (kpiRes.ok) {
          const data = await kpiRes.json();
          setKpis(data);
        }
        if (entriesRes.ok) {
          const data = await entriesRes.json();
          setRecentEntries(data.entries || []);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (!user) return null;

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Comptabilit&eacute;</h1>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse border border-gray-100 dark:border-slate-700">
              <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded w-2/3 mb-3" />
              <div className="h-6 bg-gray-200 dark:bg-slate-600 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">CA du mois</span>
            <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{formatPrice(kpis.revenue)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">TVA &agrave; payer</span>
            <p className="text-lg font-bold text-orange-500 mt-1">{formatPrice(kpis.vatDue)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Cr&eacute;ances clients</span>
            <p className="text-lg font-bold text-red-500 mt-1">{formatPrice(kpis.receivables)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Solde caisse</span>
            <p className="text-lg font-bold text-[#5BBF3E] mt-1">{formatPrice(kpis.cashBalance)}</p>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-3 gap-2">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 hover:border-[#2AA8DC]/30 transition active:scale-95"
          >
            <svg className="w-6 h-6 text-[#2AA8DC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={link.icon} />
            </svg>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-200 text-center">{link.title}</span>
          </Link>
        ))}
      </div>

      {/* Recent Journal Entries */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">&Eacute;critures r&eacute;centes</h2>
          <Link href="/accounting/journals" className="text-xs text-[#2AA8DC] font-medium">Voir tout</Link>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-slate-700 rounded animate-pulse" />
            ))}
          </div>
        ) : recentEntries.length === 0 ? (
          <p className="p-4 text-sm text-gray-400 text-center">Aucune &eacute;criture</p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-700">
            {recentEntries.map((entry) => (
              <div key={entry.id} className="px-4 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{entry.label}</p>
                  <p className="text-xs text-gray-400">
                    {entry.journal_code} &middot; {entry.entry_number} &middot; {formatDate(entry.entry_date)}
                  </p>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap ml-3">
                  {formatPrice(entry.total_debit)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
