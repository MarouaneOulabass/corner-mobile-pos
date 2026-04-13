'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { formatPrice, formatDate } from '@/lib/utils';

interface InvoiceVerification {
  invoice_number: string;
  issue_date: string;
  emitter_name: string;
  emitter_ice: string;
  client_name: string;
  total_ttc: number;
  status: string;
}

const statusLabels: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Brouillon', bg: 'bg-gray-100', text: 'text-gray-600' },
  issued: { label: 'Emise', bg: 'bg-blue-50', text: 'text-blue-600' },
  sent: { label: 'Envoyee', bg: 'bg-purple-50', text: 'text-purple-600' },
  paid: { label: 'Payee', bg: 'bg-green-50', text: 'text-green-600' },
  cancelled: { label: 'Annulee', bg: 'bg-red-50', text: 'text-red-500' },
};

export default function VerifyInvoicePage() {
  const params = useParams();
  const id = params?.id as string;
  const [invoice, setInvoice] = useState<InvoiceVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/accounting/invoices/${id}/verify`);
        if (res.ok) {
          const data = await res.json();
          setInvoice(data);
        } else {
          setError('Facture introuvable');
        }
      } catch {
        setError('Erreur de connexion');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-1">Facture introuvable</h1>
        <p className="text-sm text-gray-500 text-center">
          Le document demand&eacute; n&apos;existe pas ou n&apos;est plus disponible.
        </p>
      </div>
    );
  }

  const status = statusLabels[invoice.status] || statusLabels.draft;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2AA8DC] to-[#2AA8DC]/80 p-6 text-white text-center">
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-lg font-bold">V&eacute;rification de facture</h1>
        <p className="text-sm text-white/80 mt-1">Corner Mobile</p>
      </div>

      {/* Invoice Details */}
      <div className="p-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">{invoice.invoice_number}</span>
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${status.bg} ${status.text}`}>
              {status.label}
            </span>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Details Grid */}
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Date d&apos;&eacute;mission</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(invoice.issue_date)}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-0.5">&Eacute;metteur</p>
              <p className="text-sm font-medium text-gray-900">{invoice.emitter_name}</p>
              {invoice.emitter_ice && (
                <p className="text-xs text-gray-500">ICE: {invoice.emitter_ice}</p>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-0.5">Client</p>
              <p className="text-sm font-medium text-gray-900">{invoice.client_name}</p>
            </div>

            <div className="h-px bg-gray-100" />

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Total TTC</span>
              <span className="text-xl font-bold text-gray-900">{formatPrice(invoice.total_ttc)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Document v&eacute;rifi&eacute; via Corner Mobile POS
        </p>
      </div>
    </div>
  );
}
