'use client';

import { ProductStatus, ProductCondition, ProductType } from '@/types';
import { conditionLabels, statusLabels } from '@/lib/utils';

const BRANDS = ['Samsung', 'Apple', 'Xiaomi', 'Huawei', 'Oppo', 'Realme', 'Tecno', 'Infinix', 'Nokia', 'Autre'];

interface ProductFiltersProps {
  statusFilter: string;
  brandFilter: string;
  conditionFilter: string;
  typeFilter: string;
  activeFilterCount: number;
  onStatusChange: (v: string) => void;
  onBrandChange: (v: string) => void;
  onConditionChange: (v: string) => void;
  onTypeChange: (v: string) => void;
  onClearFilters: () => void;
}

export default function ProductFilters({
  statusFilter,
  brandFilter,
  conditionFilter,
  typeFilter,
  activeFilterCount,
  onStatusChange,
  onBrandChange,
  onConditionChange,
  onTypeChange,
  onClearFilters,
}: ProductFiltersProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 p-3 mb-3 grid grid-cols-2 gap-2">
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        className="px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
      >
        <option value="">Tous les statuts</option>
        {(['in_stock', 'sold', 'in_repair', 'transferred', 'returned'] as ProductStatus[]).map((s) => (
          <option key={s} value={s}>{statusLabels[s]}</option>
        ))}
      </select>

      <select
        value={brandFilter}
        onChange={(e) => onBrandChange(e.target.value)}
        className="px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
      >
        <option value="">Toutes les marques</option>
        {BRANDS.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>

      <select
        value={conditionFilter}
        onChange={(e) => onConditionChange(e.target.value)}
        className="px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
      >
        <option value="">Tous les etats</option>
        {(['new', 'like_new', 'good', 'fair', 'poor'] as ProductCondition[]).map((c) => (
          <option key={c} value={c}>{conditionLabels[c]}</option>
        ))}
      </select>

      <select
        value={typeFilter}
        onChange={(e) => onTypeChange(e.target.value)}
        className="px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
      >
        <option value="">Tous les types</option>
        {(['phone', 'accessory', 'part'] as ProductType[]).map((t) => (
          <option key={t} value={t}>
            {t === 'phone' ? 'Telephone' : t === 'accessory' ? 'Accessoire' : 'Piece'}
          </option>
        ))}
      </select>

      {activeFilterCount > 0 && (
        <button
          onClick={onClearFilters}
          className="col-span-2 text-xs text-[#2AA8DC] py-1"
        >
          Reinitialiser les filtres
        </button>
      )}
    </div>
  );
}
