'use client';

import { Product } from '@/types';
import { formatPrice, conditionLabels, statusColors } from '@/lib/utils';

interface ProductGridProps {
  products: Product[];
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectProduct: (p: Product) => void;
}

export default function ProductGrid({
  products,
  selectionMode,
  selectedIds,
  onToggleSelection,
  onSelectProduct,
}: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {products.map((p) => (
        <div key={p.id} className="relative">
          {selectionMode && (
            <input
              type="checkbox"
              checked={selectedIds.has(p.id)}
              onChange={() => onToggleSelection(p.id)}
              className="absolute top-2 left-2 w-5 h-5 rounded border-gray-300 text-[#2AA8DC] focus:ring-[#2AA8DC] z-10"
            />
          )}
          <button
            onClick={() => selectionMode ? onToggleSelection(p.id) : onSelectProduct(p)}
            className="w-full bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 text-left active:bg-gray-50 dark:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[p.status]}`} />
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded">
                {conditionLabels[p.condition]}
              </span>
            </div>
            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{p.brand} {p.model}</p>
            {p.storage && <p className="text-xs text-gray-400 mt-0.5">{p.storage}</p>}
            <div className="flex flex-wrap gap-1 mt-1">
              {p.bin_location && (
                <span className="text-[10px] px-1 py-0.5 bg-blue-50 text-blue-600 rounded">{p.bin_location}</span>
              )}
              {(p.warranty_months ?? 0) > 0 && (
                <span className="text-[10px] px-1 py-0.5 bg-green-50 text-green-600 rounded">{p.warranty_months}m</span>
              )}
              {p.product_type === 'accessory' && p.quantity != null && p.quantity <= 3 && (
                <span className="text-[10px] px-1 py-0.5 bg-red-50 text-red-600 rounded font-medium">Bas</span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-2">{formatPrice(p.selling_price)}</p>
          </button>
        </div>
      ))}
    </div>
  );
}
