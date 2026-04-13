'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type ExportFormat = 'csv' | 'sage' | 'ciel';

const formatOptions: { value: ExportFormat; label: string; description: string }[] = [
  { value: 'csv', label: 'CSV', description: 'Format universel, compatible Excel' },
  { value: 'sage', label: 'Sage', description: 'Format Sage Comptabilite' },
  { value: 'ciel', label: 'Ciel', description: 'Format Ciel Compta' },
];

const journalOptions = [
  { value: '', label: 'Tous les journaux' },
  { value: 'VT', label: 'Ventes (VT)' },
  { value: 'AC', label: 'Achats (AC)' },
  { value: 'CA', label: 'Caisse (CA)' },
  { value: 'BQ', label: 'Banque (BQ)' },
  { value: 'OD', label: 'Operations Diverses (OD)' },
];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function yearStartString() {
  return `${new Date().getFullYear()}-01-01`;
}

export default function ExportsPage() {
  const { user } = useAuth();
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [journal, setJournal] = useState('');
  const [dateFrom, setDateFrom] = useState(yearStartString);
  const [dateTo, setDateTo] = useState(todayString);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleExport() {
    setExporting(true);
    setError('');
    setSuccess('');
    try {
      const params = new URLSearchParams({
        format,
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (journal) params.set('journal_code', journal);

      const res = await fetch(`/api/accounting/exports?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const ext = format === 'csv' ? 'csv' : 'txt';
        const filename = `export_${format}_${dateFrom}_${dateTo}.${ext}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccess(`Export ${format.toUpperCase()} telecharge avec succes`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Erreur lors de l\'export');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setExporting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Exports comptables</h1>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-sm text-[#5BBF3E]">
          {success}
        </div>
      )}

      {/* Format Selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block">Format d&apos;export</label>
        <div className="space-y-2">
          {formatOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFormat(opt.value)}
              className={`w-full text-left p-3 rounded-xl border transition ${
                format === opt.value
                  ? 'border-[#2AA8DC] bg-[#2AA8DC]/5'
                  : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  format === opt.value ? 'border-[#2AA8DC]' : 'border-gray-300 dark:border-slate-500'
                }`}>
                  {format === opt.value && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#2AA8DC]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</p>
                  <p className="text-xs text-gray-400">{opt.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Journal Selector */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 space-y-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Journal</label>
          <select
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
          >
            {journalOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Date Range */}
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

      {/* Download Button */}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="w-full py-3 bg-[#2AA8DC] text-white font-medium rounded-xl disabled:opacity-50 active:bg-[#2AA8DC]/90 transition flex items-center justify-center gap-2"
      >
        {exporting ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Export en cours...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            T&eacute;l&eacute;charger
          </>
        )}
      </button>
    </div>
  );
}
