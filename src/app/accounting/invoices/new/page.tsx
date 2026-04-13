'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';

interface InvoiceLine {
  label: string;
  quantity: number;
  unit_price_ht: number;
  tax_rate: number;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

const defaultLine: InvoiceLine = { label: '', quantity: 1, unit_price_ht: 0, tax_rate: 20 };

export default function NewInvoicePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([{ ...defaultLine }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function searchCustomers(query: string) {
    setCustomerSearch(query);
    if (query.length < 2) { setCustomers([]); setShowDropdown(false); return; }
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setShowDropdown(true);
      }
    } catch { /* ignore */ }
  }

  function selectCustomer(c: CustomerOption) {
    setCustomerId(c.id);
    setCustomerSearch(c.name);
    setShowDropdown(false);
  }

  function updateLine(idx: number, field: keyof InvoiceLine, value: string | number) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...defaultLine }]);
  }

  function removeLine(idx: number) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  // Calculations
  const lineCalcs = lines.map((l) => {
    const ht = l.quantity * l.unit_price_ht;
    const tax = ht * (l.tax_rate / 100);
    const ttc = ht + tax;
    return { ht, tax, ttc };
  });
  const totalHT = lineCalcs.reduce((s, c) => s + c.ht, 0);
  const totalTax = lineCalcs.reduce((s, c) => s + c.tax, 0);
  const totalTTC = lineCalcs.reduce((s, c) => s + c.ttc, 0);

  async function handleSubmit() {
    if (!customerId) { setError('Veuillez selectionner un client'); return; }
    if (!dueDate) { setError('Veuillez indiquer la date d\'echeance'); return; }
    if (lines.some((l) => !l.label || l.quantity <= 0 || l.unit_price_ht <= 0)) {
      setError('Veuillez remplir toutes les lignes correctement');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/accounting/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          due_date: dueDate,
          lines: lines.map((l) => ({
            label: l.label,
            quantity: l.quantity,
            unit_price_ht: l.unit_price_ht,
            tax_rate: l.tax_rate,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(data.id ? `/accounting/invoices/${data.id}` : '/accounting/invoices');
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la creation');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nouvelle facture</h1>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Customer */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 space-y-3">
        <div className="relative">
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Client</label>
          <input
            type="text"
            value={customerSearch}
            onChange={(e) => searchCustomers(e.target.value)}
            onFocus={() => customers.length > 0 && setShowDropdown(true)}
            placeholder="Rechercher un client..."
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
          />
          {showDropdown && customers.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCustomer(c)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 text-sm"
                >
                  <span className="text-gray-900 dark:text-white">{c.name}</span>
                  <span className="text-gray-400 ml-2">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Date d&apos;&eacute;ch&eacute;ance</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Lines */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Lignes</h2>
          <button
            onClick={addLine}
            className="text-xs text-[#2AA8DC] font-medium px-3 py-1 rounded-lg bg-[#2AA8DC]/10"
          >
            + Ajouter
          </button>
        </div>

        {lines.map((line, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Ligne {idx + 1}</span>
              {lines.length > 1 && (
                <button onClick={() => removeLine(idx)} className="text-xs text-red-400 font-medium">
                  Supprimer
                </button>
              )}
            </div>
            <input
              type="text"
              value={line.label}
              onChange={(e) => updateLine(idx, 'label', e.target.value)}
              placeholder="Description"
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-400 mb-0.5 block">Qt&eacute;</label>
                <input
                  type="number"
                  value={line.quantity}
                  onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                  min="1"
                  className="w-full px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-0.5 block">Prix HT</label>
                <input
                  type="number"
                  value={line.unit_price_ht || ''}
                  onChange={(e) => updateLine(idx, 'unit_price_ht', parseFloat(e.target.value) || 0)}
                  min="0"
                  className="w-full px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-0.5 block">TVA %</label>
                <select
                  value={line.tax_rate}
                  onChange={(e) => updateLine(idx, 'tax_rate', parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  <option value={0}>0%</option>
                  <option value={7}>7%</option>
                  <option value={10}>10%</option>
                  <option value={14}>14%</option>
                  <option value={20}>20%</option>
                </select>
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>HT: {formatPrice(lineCalcs[idx]?.ht || 0)}</span>
              <span>TVA: {formatPrice(lineCalcs[idx]?.tax || 0)}</span>
              <span className="font-medium text-gray-700 dark:text-gray-200">TTC: {formatPrice(lineCalcs[idx]?.ttc || 0)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Total HT</span>
          <span className="font-medium text-gray-900 dark:text-white">{formatPrice(totalHT)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">TVA</span>
          <span className="font-medium text-orange-500">{formatPrice(totalTax)}</span>
        </div>
        <div className="flex justify-between text-sm pt-1 border-t border-gray-100 dark:border-slate-700">
          <span className="font-semibold text-gray-900 dark:text-white">Total TTC</span>
          <span className="font-bold text-lg text-gray-900 dark:text-white">{formatPrice(totalTTC)}</span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-3 bg-[#2AA8DC] text-white font-medium rounded-xl disabled:opacity-50 active:bg-[#2AA8DC]/90 transition flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Cr&eacute;ation...
          </>
        ) : (
          'Cr&eacute;er la facture'
        )}
      </button>
    </div>
  );
}
