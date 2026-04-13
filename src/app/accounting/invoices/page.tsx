'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice, formatDate } from '@/lib/utils';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  issue_date: string;
  due_date: string;
  total_ht: number;
  total_tax: number;
  total_ttc: number;
  status: 'draft' | 'issued' | 'sent' | 'paid' | 'cancelled';
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Brouillon', bg: 'bg-gray-100 dark:bg-slate-700', text: 'text-gray-600 dark:text-gray-300' },
  issued: { label: 'Emise', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
  sent: { label: 'Envoyee', bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' },
  paid: { label: 'Payee', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-[#5BBF3E]' },
  cancelled: { label: 'Annulee', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-500' },
};

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      try {
        const params = search ? `?search=${encodeURIComponent(search)}` : '';
        const res = await fetch(`/api/accounting/invoices${params}`);
        if (res.ok) {
          const data = await res.json();
          setInvoices(data.invoices || []);
        } else {
          setInvoices([]);
        }
      } catch {
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, search]);

  if (!user) return null;

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Factures</h1>
        <Link
          href="/accounting/invoices/new"
          className="px-4 py-2 bg-[#2AA8DC] text-white text-sm font-medium rounded-xl active:scale-95 transition"
        >
          + Nouvelle
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par n&deg; ou client..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400"
        />
      </div>

      {/* Invoice List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">Aucune facture</p>
          <Link
            href="/accounting/invoices/new"
            className="inline-block px-6 py-2.5 bg-[#2AA8DC] text-white text-sm font-medium rounded-xl"
          >
            Cr&eacute;er une facture
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const status = statusConfig[inv.status] || statusConfig.draft;
            const isOverdue = inv.status !== 'paid' && inv.status !== 'cancelled' && new Date(inv.due_date) < new Date();
            return (
              <Link
                key={inv.id}
                href={`/accounting/invoices/${inv.id}`}
                className="block bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 active:scale-[0.98] transition"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{inv.invoice_number}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{inv.customer_name}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-gray-400">
                    {formatDate(inv.issue_date)}
                    {isOverdue && (
                      <span className="ml-2 text-red-500 font-medium">En retard</span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{formatPrice(inv.total_ttc)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
