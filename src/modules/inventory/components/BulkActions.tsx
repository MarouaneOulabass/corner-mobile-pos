'use client';

import { Product } from '@/types';
import LabelTemplate from '@/components/features/LabelTemplate';

interface BulkActionsProps {
  selectionMode: boolean;
  selectedIds: Set<string>;
  showPrintPreview: boolean;
  products: Product[];
  onOpenPrintPreview: () => void;
  onClosePrintPreview: () => void;
}

export default function BulkActions({
  selectionMode,
  selectedIds,
  showPrintPreview,
  products,
  onOpenPrintPreview,
  onClosePrintPreview,
}: BulkActionsProps) {
  return (
    <>
      {/* Floating selection action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200 dark:border-slate-600 p-3 flex items-center justify-between z-30">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {selectedIds.size} selectionne{selectedIds.size > 1 ? 's' : ''}
          </span>
          <button
            onClick={onOpenPrintPreview}
            className="px-4 py-2 bg-[#2AA8DC] text-white text-sm font-medium rounded-xl active:scale-95 transition-transform"
          >
            Imprimer les etiquettes
          </button>
        </div>
      )}

      {/* Print preview modal */}
      {showPrintPreview && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={onClosePrintPreview} />
          <div className="fixed inset-4 bg-white dark:bg-slate-800 rounded-2xl z-50 overflow-y-auto flex flex-col">
            <div className="sticky top-0 bg-white dark:bg-slate-800 px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Apercu des etiquettes</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#2AA8DC] text-white text-sm font-medium rounded-xl"
                >
                  Imprimer
                </button>
                <button onClick={onClosePrintPreview} className="p-1 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="print-area p-4 flex flex-wrap gap-4">
              {products
                .filter((p) => selectedIds.has(p.id))
                .map((p) => (
                  <LabelTemplate
                    key={p.id}
                    product={p}
                    storeName={p.store?.name || 'Corner Mobile'}
                  />
                ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
