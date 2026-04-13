'use client';

import { Repair } from '@/types';
import { formatPrice, formatDate } from '@/lib/utils';

interface RepairCostSummaryProps {
  repair: Repair;
  isOverdue: boolean;
  finalCost: string;
  setFinalCost: (cost: string) => void;
  showFinalCost: boolean;
  setShowFinalCost: (show: boolean) => void;
  updating: boolean;
  onSaveFinalCost: () => void;
}

export default function RepairCostSummary({
  repair,
  isOverdue,
  finalCost,
  setFinalCost,
  showFinalCost,
  setShowFinalCost,
  updating,
  onSaveFinalCost,
}: RepairCostSummaryProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 space-y-2">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Coûts</h2>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-400 text-xs">Coût estimé</span>
          <p className="text-gray-900 dark:text-white font-medium">{formatPrice(repair.estimated_cost)}</p>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Acompte</span>
          <p className="text-gray-900 dark:text-white font-medium">{formatPrice(repair.deposit)}</p>
        </div>
        {repair.final_cost != null && (
          <div>
            <span className="text-gray-400 text-xs">Coût final</span>
            <p className="text-gray-900 dark:text-white font-semibold">{formatPrice(repair.final_cost)}</p>
          </div>
        )}
        {repair.estimated_completion_date && (
          <div>
            <span className="text-gray-400 text-xs">Date estimée</span>
            <p className={`${isOverdue ? 'text-red-500 font-medium' : 'text-gray-900 dark:text-white'}`}>
              {formatDate(repair.estimated_completion_date)}
            </p>
          </div>
        )}
      </div>
      {repair.technician && (
        <div className="mt-1">
          <span className="text-gray-400 text-xs">Technicien</span>
          <p className="text-sm text-gray-900 dark:text-white">{repair.technician.name}</p>
        </div>
      )}

      {/* Edit final cost */}
      {!showFinalCost &&
        repair.status !== 'delivered' &&
        repair.status !== 'cancelled' && (
          <button
            type="button"
            onClick={() => setShowFinalCost(true)}
            className="text-xs text-[#2AA8DC] font-medium mt-1"
          >
            Modifier le coût final
          </button>
        )}
      {showFinalCost && (
        <div className="flex gap-2 mt-2">
          <input
            type="number"
            placeholder="Coût final (MAD)"
            value={finalCost}
            onChange={(e) => setFinalCost(e.target.value)}
            className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
          />
          <button
            type="button"
            onClick={onSaveFinalCost}
            disabled={updating}
            className="px-3 py-2 bg-[#2AA8DC] text-white rounded-lg text-xs font-medium disabled:opacity-50"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
