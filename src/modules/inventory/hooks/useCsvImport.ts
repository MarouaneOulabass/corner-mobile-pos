'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const TARGET_FIELDS = ['brand', 'model', 'imei', 'storage', 'color', 'condition', 'purchase_price', 'selling_price', 'supplier'] as const;
export type TargetField = typeof TARGET_FIELDS[number] | '';
export { TARGET_FIELDS };

export const TARGET_FIELD_LABELS: Record<string, string> = {
  brand: 'Marque',
  model: 'Modele',
  imei: 'IMEI',
  storage: 'Stockage',
  color: 'Couleur',
  condition: 'Etat',
  purchase_price: "Prix d'achat",
  selling_price: 'Prix de vente',
  supplier: 'Fournisseur',
};

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
  return { headers, rows };
}

function autoDetectMapping(headers: string[]): TargetField[] {
  const map: Record<string, TargetField> = {
    brand: 'brand', marque: 'brand',
    model: 'model', modele: 'model',
    imei: 'imei',
    storage: 'storage', stockage: 'storage', capacite: 'storage',
    color: 'color', couleur: 'color',
    condition: 'condition', etat: 'condition',
    purchase_price: 'purchase_price', prix_achat: 'purchase_price',
    selling_price: 'selling_price', prix_vente: 'selling_price',
    supplier: 'supplier', fournisseur: 'supplier',
  };
  return headers.map((h) => map[h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')] || '');
}

export interface ImportProgress {
  done: number;
  total: number;
  errors: string[];
}

export interface UseCsvImportReturn {
  showCsvModal: boolean;
  setShowCsvModal: (v: boolean) => void;
  csvHeaders: string[];
  csvRows: string[][];
  columnMapping: TargetField[];
  setColumnMapping: React.Dispatch<React.SetStateAction<TargetField[]>>;
  importProgress: ImportProgress | null;
  importing: boolean;
  normalizing: boolean;
  csvFileRef: React.MutableRefObject<HTMLInputElement | null>;
  handleCsvFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleNormalizeWithAI: () => Promise<void>;
  handleCsvImport: () => Promise<void>;
  resetCsvModal: () => void;
}

export function useCsvImport(onImportDone: () => void): UseCsvImportReturn {
  const { user, activeStoreId } = useAuth();

  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<TargetField[]>([]);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importing, setImporting] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const csvFileRef = useRef<HTMLInputElement | null>(null);

  const handleCsvFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvRows(rows);
      setColumnMapping(autoDetectMapping(headers));
      setImportProgress(null);
    };
    reader.readAsText(file);
  }, []);

  const handleNormalizeWithAI = async () => {
    if (!user) return;
    setNormalizing(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'csv_normalize',
          data: { headers: csvHeaders, sampleRows: csvRows.slice(0, 5) },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.mapping && Array.isArray(data.mapping)) {
          setColumnMapping(data.mapping);
        }
      }
    } catch {
      // silently fail -- AI normalization is optional
    } finally {
      setNormalizing(false);
    }
  };

  const handleCsvImport = async () => {
    if (!user) return;
    setImporting(true);
    const totalRows = csvRows.length;
    setImportProgress({ done: 0, total: totalRows, errors: [] });

    const products: Record<string, unknown>[] = [];
    const skippedErrors: string[] = [];

    for (let i = 0; i < totalRows; i++) {
      const row = csvRows[i];
      const product: Record<string, string> = {};
      columnMapping.forEach((field, colIdx) => {
        if (field && row[colIdx] !== undefined) {
          product[field] = row[colIdx];
        }
      });

      if (!product.brand && !product.model) {
        skippedErrors.push(`Ligne ${i + 2}: marque et modele manquants`);
        continue;
      }

      products.push({
        brand: product.brand || 'Autre',
        model: product.model || 'Inconnu',
        imei: product.imei || undefined,
        storage: product.storage || undefined,
        color: product.color || undefined,
        condition: product.condition || 'good',
        purchase_price: Number(product.purchase_price) || 0,
        selling_price: Number(product.selling_price) || 0,
        supplier: product.supplier || undefined,
        product_type: 'phone',
        store_id: activeStoreId || user.store_id,
        created_by: user.id,
      });
    }

    try {
      const res = await fetch('/api/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });

      const data = await res.json();
      const apiErrors = (data.errors || []).map(
        (e: { row: number; error: string }) => `Ligne ${e.row + 1}: ${e.error}`
      );
      const allErrors = [...skippedErrors, ...apiErrors];

      setImportProgress({ done: totalRows, total: totalRows, errors: allErrors });
    } catch {
      setImportProgress({ done: totalRows, total: totalRows, errors: [...skippedErrors, 'Erreur reseau'] });
    }

    setImporting(false);
    onImportDone();
  };

  const resetCsvModal = () => {
    setShowCsvModal(false);
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping([]);
    setImportProgress(null);
    setImporting(false);
    if (csvFileRef.current) csvFileRef.current.value = '';
  };

  return {
    showCsvModal,
    setShowCsvModal,
    csvHeaders,
    csvRows,
    columnMapping,
    setColumnMapping,
    importProgress,
    importing,
    normalizing,
    csvFileRef,
    handleCsvFileChange,
    handleNormalizeWithAI,
    handleCsvImport,
    resetCsvModal,
  };
}
