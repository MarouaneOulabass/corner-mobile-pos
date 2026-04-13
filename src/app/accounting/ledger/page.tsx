'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice, formatDate } from '@/lib/utils';

interface Account {
  code: string;
  label: string;
}

interface LedgerLine {
  id: string;
  entry_date: string;
  entry_number: string;
  label: string;
  debit: number;
  credit: number;
  running_balance: number;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function yearStartString() {
  return `${new Date().getFullYear()}-01-01`;
}

export default function LedgerPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [dateFrom, setDateFrom] = useState(yearStartString);
  const [dateTo, setDateTo] = useState(todayString);
  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [loading, setLoading] = useState(false);

  // Load chart of accounts
  useEffect(() => {
    if (!user) return;
    fetch('/api/accounting/accounts')
      .then((r) => r.json())
      .then((data) => {
        if (data.accounts) setAccounts(data.accounts);
      })
      .catch(() => {});
  }, [user]);

  // Load ledger when account or dates change
  useEffect(() => {
    if (!user || !selectedAccount) return;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          account_code: selectedAccount,
          date_from: dateFrom,
          date_to: dateTo,
        });
        const res = await fetch(`/api/accounting/ledger?${params}`);
        if (res.ok) {
          const data = await res.json();
          setLines(data.lines || []);
        } else {
          setLines([]);
        }
      } catch {
        setLines([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, selectedAccount, dateFrom, dateTo]);

  if (!user) return null;

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const balance = totalDebit - totalCredit;

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Grand Livre</h1>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 space-y-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Compte</label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
          >
            <option value="">S&eacute;lectionner un compte</option>
            {accounts.map((acc) => (
              <option key={acc.code} value={acc.code}>
                {acc.code} - {acc.label}
              </option>
            ))}
          </select>
        </div>
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

      {!selectedAccount ? (
        <p className="text-center text-gray-400 py-12">S&eacute;lectionnez un compte pour afficher le grand livre</p>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : lines.length === 0 ? (
        <p className="text-center text-gray-400 py-12">Aucun mouvement pour ce compte</p>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400">
                  <th className="text-left px-3 py-2 font-medium text-xs">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Libell&eacute;</th>
                  <th className="text-right px-3 py-2 font-medium text-xs">D&eacute;bit</th>
                  <th className="text-right px-3 py-2 font-medium text-xs">Cr&eacute;dit</th>
                  <th className="text-right px-3 py-2 font-medium text-xs">Solde</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-t border-gray-50 dark:border-slate-700">
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300 text-xs whitespace-nowrap">{formatDate(line.entry_date)}</td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-100 text-xs">
                      <span className="text-gray-400 mr-1">{line.entry_number}</span>
                      {line.label}
                    </td>
                    <td className="px-3 py-2 text-right text-xs whitespace-nowrap">{line.debit > 0 ? formatPrice(line.debit) : ''}</td>
                    <td className="px-3 py-2 text-right text-xs whitespace-nowrap">{line.credit > 0 ? formatPrice(line.credit) : ''}</td>
                    <td className={`px-3 py-2 text-right text-xs font-medium whitespace-nowrap ${line.running_balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
                      {formatPrice(Math.abs(line.running_balance))}
                      {line.running_balance < 0 ? ' Cr' : ' Db'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 font-medium">
                  <td colSpan={2} className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200">Total</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-900 dark:text-white whitespace-nowrap">{formatPrice(totalDebit)}</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-900 dark:text-white whitespace-nowrap">{formatPrice(totalCredit)}</td>
                  <td className={`px-3 py-2 text-right text-xs font-bold whitespace-nowrap ${balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
                    {formatPrice(Math.abs(balance))}
                    {balance < 0 ? ' Cr' : ' Db'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
