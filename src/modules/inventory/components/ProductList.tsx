'use client';

import { Product } from '@/types';
import { formatPrice, conditionLabels, statusLabels, statusColors } from '@/lib/utils';
import IMEIBlacklistBadge from '@/components/features/IMEIBlacklistBadge';

interface ProductListProps {
  products: Product[];
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectProduct: (p: Product) => void;
}

export default function ProductList({
  products,
  selectionMode,
  selectedIds,
  onToggleSelection,
  onSelectProduct,
}: ProductListProps) {
  return (
    <div className="space-y-2">
      {products.map((p) => (
        <div key={p.id} className="flex items-center gap-2">
          {selectionMode && (
            <input
              type="checkbox"
              checked={selectedIds.has(p.id)}
              onChange={() => onToggleSelection(p.id)}
              className="w-5 h-5 rounded border-gray-300 text-[#2AA8DC] focus:ring-[#2AA8DC] flex-shrink-0"
            />
          )}
          <button
            onClick={() => selectionMode ? onToggleSelection(p.id) : onSelectProduct(p)}
            className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 flex items-center gap-3 text-left active:bg-gray-50 dark:bg-slate-900 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[p.status]}`} />
                <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                  {p.brand} {p.model}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {p.storage && (
                  <span className="text-xs text-gray-400">{p.storage}</span>
                )}
                <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded">
                  {conditionLabels[p.condition]}
                </span>
                {p.bin_location && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                    {p.bin_location}
                  </span>
                )}
                {(p.warranty_months ?? 0) > 0 && (
                  <span className="text-xs px-1.5 py-0.5 bg-green-50 text-green-600 rounded">
                    {p.warranty_months} mois
                  </span>
                )}
                {p.product_type === 'accessory' && p.quantity != null && p.quantity <= 3 && (
                  <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-medium">
                    Stock bas
                  </span>
                )}
              </div>
              {p.product_type === 'phone' && p.imei && (
                <div className="mt-1">
                  <IMEIBlacklistBadge imei={p.imei} autoCheck={false} />
                </div>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatPrice(p.selling_price)}</p>
              <p className="text-[10px] text-gray-400">{statusLabels[p.status]}</p>
            </div>
          </button>
        </div>
      ))}
    </div>
  );
}
