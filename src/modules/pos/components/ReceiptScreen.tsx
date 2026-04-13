'use client';

import React, { useState, useMemo } from 'react';
import { formatPrice, formatDateTime, generateWhatsAppLink } from '@/lib/utils';
import type { Sale, User } from '@/types';
import ThermalPrintButton from '@/components/features/ThermalPrintButton';
import ReceiptPreview from '@/components/features/ReceiptPreview';
import { buildReceiptHTML, buildReceiptESCPOS } from '@/lib/receipt-builder';

interface ReceiptScreenProps {
  sale: Sale;
  user: User | null;
  storeId: string;
  newCustomerPhone: string;
  onNewSale: () => void;
}

export default function ReceiptScreen({ sale, user, storeId, newCustomerPhone, onNewSale }: ReceiptScreenProps) {
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);

  const receiptESCPOS = useMemo(() => {
    try {
      const store = { id: storeId, name: 'Corner Mobile', location: '', created_at: '' };
      return buildReceiptESCPOS(sale, store);
    } catch {
      return null;
    }
  }, [sale, storeId]);

  const receiptHTML = useMemo(() => {
    try {
      const store = { id: storeId, name: 'Corner Mobile', location: '', created_at: '' };
      const template = {
        id: 'default',
        store_id: storeId,
        header_text: 'Corner Mobile',
        footer_text: '',
        show_logo: false,
        show_store_address: true,
        show_seller_name: true,
        show_qr_code: false,
        paper_width: '58mm' as const,
        font_size: 'medium' as const,
        updated_at: '',
      };
      return buildReceiptHTML(sale, template, store);
    } catch {
      return '';
    }
  }, [sale, storeId]);

  const generateReceiptMessage = (s: Sale) => {
    const pmLabels: Record<string, string> = {
      cash: 'Esp\u00e8ces',
      card: 'Carte',
      virement: 'Virement',
      mixte: 'Mixte',
      gift_card: 'Carte cadeau',
      store_credit: 'Avoir',
    };
    let msg = '*Corner Mobile - Re\u00e7u*\n';
    msg += `Date: ${formatDateTime(s.created_at)}\n`;
    msg += `Vendeur: ${s.seller?.name || user?.name || ''}\n\n`;
    msg += '*Articles:*\n';
    s.items?.forEach((item) => {
      const name = item.product
        ? `${item.product.brand} ${item.product.model}`
        : 'Article';
      msg += `- ${name} x${item.quantity}: ${formatPrice(item.unit_price * item.quantity)}\n`;
    });
    msg += '\n';
    if (s.discount_amount > 0) {
      msg += `Remise: -${formatPrice(s.discount_amount)}\n`;
    }
    msg += `*Total: ${formatPrice(s.total)}*\n`;
    msg += `Paiement: ${pmLabels[s.payment_method] || s.payment_method}\n`;
    msg += '\nMerci pour votre achat!';
    return msg;
  };

  const receiptMsg = generateReceiptMessage(sale);
  const custPhone = sale.customer?.phone || newCustomerPhone || '';

  return (
    <div className="min-h-screen bg-[#0F172A] text-white p-4">
      <div className="max-w-lg mx-auto">
        {/* Success header */}
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Vente confirm&eacute;e</h2>
          <p className="text-slate-400 text-sm mt-1">
            {formatDateTime(sale.created_at)}
          </p>
        </div>

        {/* Receipt card */}
        <div className="bg-slate-800 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">ARTICLES</h3>
          {sale.items?.map((item, i) => (
            <div
              key={i}
              className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0"
            >
              <div>
                <p className="text-sm">
                  {item.product
                    ? `${item.product.brand} ${item.product.model}`
                    : 'Article'}
                </p>
                <p className="text-xs text-slate-400">x{item.quantity}</p>
              </div>
              <p className="text-sm font-medium">
                {formatPrice(item.unit_price * item.quantity)}
              </p>
            </div>
          ))}

          <div className="border-t border-slate-600 mt-3 pt-3 space-y-1">
            {sale.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-yellow-400">
                <span>Remise</span>
                <span>-{formatPrice(sale.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatPrice(sale.total)}</span>
            </div>
          </div>

          {sale.customer && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <p className="text-xs text-slate-400">Client</p>
              <p className="text-sm">
                {sale.customer.name} - {sale.customer.phone}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {/* Thermal print button */}
          <ThermalPrintButton
            receiptData={receiptESCPOS}
            fallbackHTML={receiptHTML}
            label="Imprimer le recu"
          />

          {/* Receipt preview button */}
          <button
            onClick={() => setShowReceiptPreview(true)}
            className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Aper&ccedil;u re&ccedil;u
          </button>

          {/* WhatsApp share */}
          {custPhone && (
            <a
              href={generateWhatsAppLink(custPhone, receiptMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.75.75 0 00.917.918l4.458-1.495A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.37 0-4.567-.7-6.412-1.9l-.45-.3-3.15 1.055 1.055-3.15-.3-.45A9.935 9.935 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
              Partager WhatsApp
            </a>
          )}

          <button
            onClick={onNewSale}
            className="w-full bg-[#2AA8DC] hover:bg-[#2596c4] text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Nouvelle vente
          </button>
        </div>
      </div>

      {/* Receipt preview modal */}
      {showReceiptPreview && receiptHTML && (
        <ReceiptPreview
          html={receiptHTML}
          onClose={() => setShowReceiptPreview(false)}
          onPrintBrowser={() => {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(receiptHTML);
              printWindow.document.close();
              printWindow.print();
            }
          }}
          onShare={custPhone ? () => {
            window.open(generateWhatsAppLink(custPhone, receiptMsg), '_blank');
          } : undefined}
        />
      )}
    </div>
  );
}
