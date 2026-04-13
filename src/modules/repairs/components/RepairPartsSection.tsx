'use client';

import { RepairPartUsed, RepairStatus } from '@/types';
import { formatPrice } from '@/lib/utils';
import { RepairPartsState } from '../hooks/useRepairParts';
import CollapsibleSection from './CollapsibleSection';

interface RepairPartsSectionProps {
  partsUsed: RepairPartUsed[];
  parts: RepairPartsState;
  repairStatus: RepairStatus;
}

export default function RepairPartsSection({
  partsUsed,
  parts,
  repairStatus,
}: RepairPartsSectionProps) {
  const isEditable = repairStatus !== 'delivered' && repairStatus !== 'cancelled';

  return (
    <CollapsibleSection
      title="Pièces utilisées"
      icon={
        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      }
      badge={
        partsUsed.length > 0 ? (
          <span className="bg-emerald-100 text-emerald-600 text-xs px-1.5 py-0.5 rounded-full">
            {partsUsed.length}
          </span>
        ) : null
      }
      defaultOpen={partsUsed.length > 0}
    >
      {/* Parts list */}
      {partsUsed.length > 0 ? (
        <div className="space-y-2">
          {partsUsed.map((pu) => (
            <div
              key={pu.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-700"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {pu.part?.name || 'Pièce'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {pu.quantity} x {formatPrice(pu.unit_cost)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatPrice(pu.quantity * pu.unit_cost)}
                </span>
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => parts.handleRemovePart(pu.id)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
          {/* Total */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-slate-600">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Total pièces</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{formatPrice(parts.partsTotalCost)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-2">Aucune pièce ajoutée</p>
      )}

      {/* Add part button */}
      {isEditable && (
        <>
          {!parts.showAddPart ? (
            <button
              type="button"
              onClick={() => parts.setShowAddPart(true)}
              className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 dark:text-gray-400 rounded-lg text-sm font-medium hover:border-[#2AA8DC] hover:text-[#2AA8DC] transition-colors"
            >
              + Ajouter une pièce
            </button>
          ) : (
            <div className="mt-3 space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              {/* Search input */}
              <input
                type="text"
                placeholder="Rechercher une pièce..."
                value={parts.partSearch}
                onChange={(e) => parts.handleSearchParts(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
              />

              {/* Search results */}
              {parts.searchingParts && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Recherche...</p>
              )}
              {parts.partSearchResults.length > 0 && !parts.selectedPart && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {parts.partSearchResults.map((part) => (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() => {
                        parts.setSelectedPart(part);
                        parts.setNewPartCost(String(part.selling_price));
                      }}
                      className="w-full text-left p-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 hover:border-[#2AA8DC] transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{part.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {part.category} - Stock: {part.quantity} - {formatPrice(part.selling_price)}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected part form */}
              {parts.selectedPart && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded-lg border border-[#2AA8DC]">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{parts.selectedPart.name}</span>
                    <button
                      type="button"
                      onClick={() => parts.setSelectedPart(null)}
                      className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-xs"
                    >
                      Changer
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Quantité</label>
                      <input
                        type="number"
                        min="1"
                        value={parts.newPartQty}
                        onChange={(e) => parts.setNewPartQty(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Coût unitaire (MAD)</label>
                      <input
                        type="number"
                        min="0"
                        value={parts.newPartCost}
                        onChange={(e) => parts.setNewPartCost(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={parts.resetAddPartForm}
                      className="flex-1 py-2 border border-gray-300 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={parts.handleAddPart}
                      disabled={parts.addingPart}
                      className="flex-1 py-2 bg-[#2AA8DC] text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {parts.addingPart ? 'Ajout...' : 'Ajouter'}
                    </button>
                  </div>
                </div>
              )}

              {/* Cancel if nothing selected */}
              {!parts.selectedPart && (
                <button
                  type="button"
                  onClick={parts.resetAddPartForm}
                  className="w-full py-1.5 text-gray-500 dark:text-gray-400 text-xs font-medium"
                >
                  Annuler
                </button>
              )}
            </div>
          )}
        </>
      )}
    </CollapsibleSection>
  );
}
