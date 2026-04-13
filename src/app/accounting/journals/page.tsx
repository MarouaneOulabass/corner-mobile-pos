'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice, formatDate } from '@/lib/utils';

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  journal_code: string;
  label: string;
  total_debit: number;
  total_credit: number;
  lines?: { account_code: string; account_label: string; debit: number; credit: number }[];
}

const journalTabs = [
  { code: 'VT', label: 'Ventes' },
  { code: 'AC', label: 'Achats' },
  { code: 'CA', label: 'Caisse' },
  { code: 'BQ', label: 'Banque' },
  { code: 'OD', label: 'Op. Div.' },
];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoString() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export default function JournalsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('VT');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(monthAgoString);
  const [dateTo, setDateTo] = useState(todayString);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          journal_code: activeTab,
          date_from: dateFrom,
          date_to: dateTo,
        });
        const res = await fetch(`/api/accounting/journal-entries?${params}`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries || []);
        } else {
          setEntries([]);
        }
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, activeTab, dateFrom, dateTo]);

  if (!user) return null;

  const totalDebit = entries.reduce((s, e) => s + e.total_debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.total_credit, 0);

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Journaux comptables</h1>

      {/* Journal Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4">
        {journalTabs.map((tab) => (
          <button
            key={tab.code}
            onClick={() => { setActiveTab(tab.code); setExpandedId(null); }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
              activeTab === tab.code
                ? 'bg-[#2AA8DC] text-white'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Totals */}
      {!loading && entries.length > 0 && (
        <div className="flex gap-2">
          <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-[#2AA8DC]">{formatPrice(totalDebit)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total d&eacute;bit</p>
          </div>
          <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-[#5BBF3E]">{formatPrice(totalCredit)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total cr&eacute;dit</p>
          </div>
        </div>
      )}

      {/* Entries List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center text-gray-400 py-12">Aucune &eacute;criture pour cette p&eacute;riode</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div key={entry.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{entry.label}</p>
                      <p className="text-xs text-gray-400">{entry.entry_number} &middot; {formatDate(entry.entry_date)}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
                        {formatPrice(entry.total_debit)}
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {isExpanded && entry.lines && (
                  <div className="border-t border-gray-100 dark:border-slate-700">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400">
                          <th className="text-left px-3 py-1.5 font-medium text-xs">Compte</th>
                          <th className="text-right px-3 py-1.5 font-medium text-xs">D&eacute;bit</th>
                          <th className="text-right px-3 py-1.5 font-medium text-xs">Cr&eacute;dit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.lines.map((line, idx) => (
                          <tr key={idx} className="border-t border-gray-50 dark:border-slate-700">
                            <td className="px-3 py-2 text-gray-800 dark:text-gray-100 text-xs">
                              {line.account_code} - {line.account_label}
                            </td>
                            <td className="px-3 py-2 text-right text-xs">{line.debit > 0 ? formatPrice(line.debit) : ''}</td>
                            <td className="px-3 py-2 text-right text-xs">{line.credit > 0 ? formatPrice(line.credit) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
