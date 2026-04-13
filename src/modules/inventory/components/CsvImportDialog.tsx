'use client';

import { TargetField, TARGET_FIELDS, TARGET_FIELD_LABELS } from '../hooks/useCsvImport';
import type { ImportProgress } from '../hooks/useCsvImport';

interface CsvImportDialogProps {
  csvHeaders: string[];
  csvRows: string[][];
  columnMapping: TargetField[];
  onMappingChange: (index: number, value: TargetField) => void;
  importProgress: ImportProgress | null;
  importing: boolean;
  normalizing: boolean;
  csvFileRef: React.MutableRefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNormalizeWithAI: () => void;
  onImport: () => void;
  onClose: () => void;
}

export default function CsvImportDialog({
  csvHeaders,
  csvRows,
  columnMapping,
  onMappingChange,
  importProgress,
  importing,
  normalizing,
  csvFileRef,
  onFileChange,
  onNormalizeWithAI,
  onImport,
  onClose,
}: CsvImportDialogProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={() => !importing && onClose()} />
      <div className="fixed inset-4 bg-white dark:bg-slate-800 rounded-2xl z-50 overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-white dark:bg-slate-800 px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Importer CSV</h2>
          <button onClick={() => !importing && onClose()} className="p-1 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-4 flex-1">
          {/* File input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Fichier CSV</label>
            <input
              ref={csvFileRef}
              type="file"
              accept=".csv"
              onChange={onFileChange}
              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#2AA8DC] file:text-white hover:file:bg-[#2490c0] file:cursor-pointer"
            />
          </div>

          {/* Preview table */}
          {csvHeaders.length > 0 && (
            <>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Apercu ({Math.min(csvRows.length, 5)} premieres lignes sur {csvRows.length})</p>
                <div className="overflow-x-auto border border-gray-200 dark:border-slate-600 rounded-lg">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-slate-900">
                      <tr>
                        {csvHeaders.map((h, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 5).map((row, ri) => (
                        <tr key={ri} className="border-t border-gray-100 dark:border-slate-700">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-1.5 text-gray-700 dark:text-gray-200 whitespace-nowrap">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Column mapping */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Correspondance des colonnes</p>
                <div className="space-y-2">
                  {csvHeaders.map((h, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 dark:text-gray-300 w-32 truncate flex-shrink-0">{h}</span>
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <select
                        value={columnMapping[i] || ''}
                        onChange={(e) => onMappingChange(i, e.target.value as TargetField)}
                        className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
                      >
                        <option value="">-- Ignorer --</option>
                        {TARGET_FIELDS.map((f) => (
                          <option key={f} value={f}>{TARGET_FIELD_LABELS[f]}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI normalize button */}
              <button
                onClick={onNormalizeWithAI}
                disabled={normalizing}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 transition flex items-center justify-center gap-2 border border-purple-200 disabled:opacity-50"
              >
                {normalizing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    Normalisation...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Normaliser avec l&apos;IA
                  </>
                )}
              </button>

              {/* Import progress */}
              {importProgress && (
                <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Progression</span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{importProgress.done}/{importProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-2">
                    <div
                      className="bg-[#2AA8DC] h-2 rounded-full transition-all"
                      style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                    />
                  </div>
                  {importProgress.errors.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      {importProgress.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-500">{err}</p>
                      ))}
                    </div>
                  )}
                  {!importing && importProgress.done === importProgress.total && (
                    <p className="text-sm text-green-600 font-medium">
                      Import termine ! {importProgress.total - importProgress.errors.length} produit(s) importe(s).
                    </p>
                  )}
                </div>
              )}

              {/* Confirm import button */}
              <button
                onClick={onImport}
                disabled={importing || columnMapping.every(m => !m)}
                className="w-full py-3 px-4 rounded-xl bg-[#2AA8DC] text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Import en cours...
                  </>
                ) : (
                  "Confirmer l'import"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
