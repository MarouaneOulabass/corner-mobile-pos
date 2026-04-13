'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';

interface BalanceLine {
  account_code: string;
  account_label: string;
  class_number: number;
  total_debit: number;
  total_credit: number;
  balance: number;
}

const classLabels: Record<number, string> = {
  1: 'Comptes de capitaux',
  2: 'Comptes d\'immobilisations',
  3: 'Comptes de stocks',
  4: 'Comptes de tiers',
  5: 'Comptes financiers',
  6: 'Comptes de charges',
  7: 'Comptes de produits',
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function BalancePage() {
  const { user } = useAuth();
  const [asOfDate, setAsOfDate] = useState(todayString);
  const [lines, setLines] = useState<BalanceLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/accounting/balance?as_of=${asOfDate}`);
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
  }, [user, asOfDate]);

  if (!user) return null;

  // Group by class
  const grouped = lines.reduce<Record<number, BalanceLine[]>>((acc, line) => {
    const cls = line.class_number || parseInt(line.account_code.charAt(0)) || 0;
    if (!acc[cls]) acc[cls] = [];
    acc[cls].push(line);
    return acc;
  }, {});

  const totalDebit = lines.reduce((s, l) => s + l.total_debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.total_credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Balance comptable</h1>

      {/* Date Picker */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3">
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Au</label>
        <input
          type="date"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
        />
      </div>

      {/* Balance Status */}
      {!loading && lines.length > 0 && (
        <div className={`rounded-xl p-3 text-center text-sm font-medium ${
          isBalanced
            ? 'bg-green-50 dark:bg-green-900/20 text-[#5BBF3E]'
            : 'bg-red-50 dark:bg-red-900/20 text-red-500'
        }`}>
          {isBalanced ? 'Balance equilibree' : `Ecart: ${formatPrice(Math.abs(totalDebit - totalCredit))}`}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : lines.length === 0 ? (
        <p className="text-center text-gray-400 py-12">Aucune donn&eacute;e</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([classNum, classLines]) => (
              <div key={classNum} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Classe {classNum} &mdash; {classLabels[Number(classNum)] || 'Autres'}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 dark:text-gray-400">
                        <th className="text-left px-3 py-1.5 font-medium text-xs">Compte</th>
                        <th className="text-right px-3 py-1.5 font-medium text-xs">D&eacute;bit</th>
                        <th className="text-right px-3 py-1.5 font-medium text-xs">Cr&eacute;dit</th>
                        <th className="text-right px-3 py-1.5 font-medium text-xs">Solde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classLines.map((line) => (
                        <tr key={line.account_code} className="border-t border-gray-50 dark:border-slate-700">
                          <td className="px-3 py-2 text-xs">
                            <span className="font-medium text-gray-900 dark:text-white">{line.account_code}</span>
                            <span className="text-gray-500 dark:text-gray-400 ml-1">{line.account_label}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-xs whitespace-nowrap">{line.total_debit > 0 ? formatPrice(line.total_debit) : ''}</td>
                          <td className="px-3 py-2 text-right text-xs whitespace-nowrap">{line.total_credit > 0 ? formatPrice(line.total_credit) : ''}</td>
                          <td className={`px-3 py-2 text-right text-xs font-medium whitespace-nowrap ${line.balance >= 0 ? '' : 'text-red-500'}`}>
                            {formatPrice(Math.abs(line.balance))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

          {/* Grand Total */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border-2 border-gray-200 dark:border-slate-600 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <tr className="font-bold">
                  <td className="px-3 py-3 text-gray-900 dark:text-white text-sm">TOTAL</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-900 dark:text-white whitespace-nowrap">{formatPrice(totalDebit)}</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-900 dark:text-white whitespace-nowrap">{formatPrice(totalCredit)}</td>
                  <td className="px-3 py-3 text-right text-sm whitespace-nowrap">{formatPrice(Math.abs(totalDebit - totalCredit))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
