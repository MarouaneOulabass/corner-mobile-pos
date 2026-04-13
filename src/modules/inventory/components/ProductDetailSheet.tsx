'use client';

import { Product } from '@/types';
import { formatPrice, conditionLabels, statusLabels, statusColors } from '@/lib/utils';
import IMEIBlacklistBadge from '@/components/features/IMEIBlacklistBadge';

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{value}</p>
    </div>
  );
}

interface ProductDetailSheetProps {
  product: Product;
  canTransfer: boolean;
  showTransferConfirm: boolean;
  transferring: boolean;
  transferDestinationName: string;
  onClose: () => void;
  onTransferClick: () => void;
  onTransferCancel: () => void;
  onTransferConfirm: () => void;
  onPrintLabel: () => void;
}

export default function ProductDetailSheet({
  product,
  canTransfer,
  showTransferConfirm,
  transferring,
  transferDestinationName,
  onClose,
  onTransferClick,
  onTransferCancel,
  onTransferConfirm,
  onPrintLabel,
}: ProductDetailSheetProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 rounded-t-2xl z-50 max-h-[80vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-white dark:bg-slate-800 pt-3 pb-2 px-4 border-b border-gray-100 dark:border-slate-700">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {product.brand} {product.model}
            </h2>
            <button onClick={onClose} className="p-1 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {/* Status & condition */}
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs text-white ${statusColors[product.status]}`}>
              {statusLabels[product.status]}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200">
              {conditionLabels[product.condition]}
            </span>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {product.imei && (
              <div className="col-span-2">
                <DetailItem label="IMEI" value={product.imei} />
                <div className="mt-1">
                  <IMEIBlacklistBadge imei={product.imei} autoCheck={true} />
                </div>
              </div>
            )}
            <DetailItem
              label="Type"
              value={product.product_type === 'phone' ? 'Telephone' : product.product_type === 'accessory' ? 'Accessoire' : 'Piece'}
            />
            {product.storage && (
              <DetailItem label="Stockage" value={product.storage} />
            )}
            {product.color && (
              <DetailItem label="Couleur" value={product.color} />
            )}
            <DetailItem label="Prix d'achat" value={formatPrice(product.purchase_price)} />
            <DetailItem label="Prix de vente" value={formatPrice(product.selling_price)} />
            {product.supplier && (
              <DetailItem label="Fournisseur" value={product.supplier} />
            )}
            {product.supplier_id && (
              <DetailItem label="ID Fournisseur" value={product.supplier_id} />
            )}
            {product.bin_location && (
              <DetailItem label="Emplacement" value={product.bin_location} />
            )}
            {(product.warranty_months ?? 0) > 0 && (
              <DetailItem label="Garantie" value={`${product.warranty_months} mois`} />
            )}
            {product.store?.name && (
              <DetailItem label="Magasin" value={product.store.name} />
            )}
          </div>

          {product.notes && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-700 dark:text-gray-200">{product.notes}</p>
            </div>
          )}

          {/* Transfer button */}
          {canTransfer && !showTransferConfirm && (
            <button
              onClick={onTransferClick}
              className="w-full py-2.5 px-4 rounded-xl bg-orange-50 text-orange-700 text-sm font-medium hover:bg-orange-100 transition flex items-center justify-center gap-2 border border-orange-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Transferer
            </button>
          )}

          {/* Transfer confirmation */}
          {canTransfer && showTransferConfirm && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
              <p className="text-sm text-orange-800 font-medium">
                Transferer vers {transferDestinationName} ?
              </p>
              <p className="text-xs text-orange-600">
                {product.brand} {product.model} sera deplace vers le magasin {transferDestinationName}.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onTransferCancel}
                  className="flex-1 py-2 px-3 rounded-lg border border-gray-300 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800"
                  disabled={transferring}
                >
                  Annuler
                </button>
                <button
                  onClick={onTransferConfirm}
                  disabled={transferring}
                  className="flex-1 py-2 px-3 rounded-lg bg-orange-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {transferring ? 'Transfert...' : 'Confirmer'}
                </button>
              </div>
            </div>
          )}

          {/* Single product print label button */}
          <button
            onClick={onPrintLabel}
            className="w-full py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:bg-slate-600 transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimer l&apos;etiquette
          </button>
        </div>
      </div>

      {/* Slide-up animation */}
      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
