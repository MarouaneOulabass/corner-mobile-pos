'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Product, ProductStatus, ProductCondition, ProductType } from '@/types';
import {
  formatPrice,
  conditionLabels,
  statusLabels,
  statusColors,
} from '@/lib/utils';
import LabelTemplate from '@/components/features/LabelTemplate';

const BRANDS = ['Samsung', 'Apple', 'Xiaomi', 'Huawei', 'Oppo', 'Realme', 'Tecno', 'Infinix', 'Nokia', 'Autre'];
const PAGE_SIZE = 20;

const STORES = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'M1' },
  { id: 'a0000000-0000-0000-0000-000000000002', name: 'M2' },
];

const TARGET_FIELDS = ['brand', 'model', 'imei', 'storage', 'color', 'condition', 'purchase_price', 'selling_price', 'supplier'] as const;
type TargetField = typeof TARGET_FIELDS[number] | '';

const TARGET_FIELD_LABELS: Record<string, string> = {
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
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));
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
  return headers.map(h => map[h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')] || '');
}

export default function StockPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // View
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Detail sheet
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Transfer
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);

  // CSV Import
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<TargetField[]>([]);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const csvFileRef = useRef<HTMLInputElement | null>(null);

  const observerRef = useRef<HTMLDivElement | null>(null);

  const fetchProducts = useCallback(
    async (pageNum: number, append = false) => {
      if (!user) return;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('page', String(pageNum));
        params.set('limit', String(PAGE_SIZE));
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        if (brandFilter) params.set('brand', brandFilter);
        if (conditionFilter) params.set('condition', conditionFilter);
        if (typeFilter) params.set('product_type', typeFilter);
        if (user.role !== 'superadmin') params.set('store_id', user.store_id);

        const res = await fetch(`/api/products?${params.toString()}`, {
          headers: {
            'x-user-store': user.store_id,
            'x-user-role': user.role,
          },
        });
        const data = await res.json();

        if (append) {
          setProducts((prev) => [...prev, ...(data.products || [])]);
        } else {
          setProducts(data.products || []);
        }
        setTotal(data.total || 0);
      } catch {
        setError('Erreur de chargement');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, search, statusFilter, brandFilter, conditionFilter, typeFilter]
  );

  // Reset and fetch on filter change
  useEffect(() => {
    setPage(1);
    fetchProducts(1);
  }, [fetchProducts]);

  // Infinite scroll observer
  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && products.length < total) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchProducts(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [products.length, total, page, loadingMore, fetchProducts]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeFilterCount = [statusFilter, brandFilter, conditionFilter, typeFilter].filter(Boolean).length;

  // --- CSV Import handlers ---
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

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
      // silently fail — AI normalization is optional
    } finally {
      setNormalizing(false);
    }
  };

  const handleCsvImport = async () => {
    if (!user) return;
    setImporting(true);
    const totalRows = csvRows.length;
    setImportProgress({ done: 0, total: totalRows, errors: [] });

    // Build all products from CSV rows
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

      // Skip rows with no brand or model
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
        store_id: user.store_id,
        created_by: user.id,
      });
    }

    try {
      const res = await fetch('/api/products/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-store': user.store_id,
          'x-user-role': user.role,
          'x-user-id': user.id,
        },
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
    // Refresh list after import
    fetchProducts(1);
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

  // --- Transfer handler ---
  const getTransferDestination = (currentStoreId: string) => {
    const other = STORES.find(s => s.id !== currentStoreId);
    return other || STORES[1];
  };

  const handleTransfer = async () => {
    if (!user || !selectedProduct) return;
    setTransferring(true);
    const dest = getTransferDestination(selectedProduct.store_id);
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-store': user.store_id,
          'x-user-role': user.role,
        },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          to_store_id: dest.id,
        }),
      });
      if (res.ok) {
        setTransferMessage(`Produit transfere vers ${dest.name} avec succes`);
        setShowTransferConfirm(false);
        setSelectedProduct(null);
        fetchProducts(1);
        // Auto-clear success message
        setTimeout(() => setTransferMessage(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setTransferMessage(`Erreur: ${errData.error || 'Echec du transfert'}`);
        setTimeout(() => setTransferMessage(null), 4000);
      }
    } catch {
      setTransferMessage('Erreur reseau lors du transfert');
      setTimeout(() => setTransferMessage(null), 4000);
    } finally {
      setTransferring(false);
    }
  };

  const canTransfer = user && (user.role === 'manager' || user.role === 'superadmin') && selectedProduct?.status === 'in_stock';

  return (
    <div className="px-4 pt-4">
      {error && <div className="mx-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm mb-3">{error} <button onClick={() => { setError(null); fetchProducts(1); }} className="ml-2 underline">Ressayer</button></div>}

      {/* Transfer toast */}
      {transferMessage && (
        <div className={`mx-4 p-3 rounded-xl text-sm mb-3 ${transferMessage.startsWith('Erreur') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {transferMessage}
        </div>
      )}

      {/* Search bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="IMEI, modele, marque..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
          />
        </div>

        {/* CSV Import button */}
        <button
          onClick={() => setShowCsvModal(true)}
          className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500"
          title="Importer CSV"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`relative p-2.5 rounded-xl border ${
            showFilters || activeFilterCount > 0
              ? 'bg-[#2AA8DC] text-white border-[#2AA8DC]'
              : 'bg-white text-gray-500 border-gray-200'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Selection toggle */}
        <button
          onClick={() => {
            setSelectionMode(!selectionMode);
            if (selectionMode) setSelectedIds(new Set());
          }}
          className={`px-2.5 py-2 rounded-xl border text-xs font-medium ${
            selectionMode
              ? 'bg-[#2AA8DC] text-white border-[#2AA8DC]'
              : 'bg-white text-gray-500 border-gray-200'
          }`}
        >
          Selectionner
        </button>

        {/* View toggle */}
        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500"
        >
          {viewMode === 'list' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3 grid grid-cols-2 gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">Tous les statuts</option>
            {(['in_stock', 'sold', 'in_repair', 'transferred', 'returned'] as ProductStatus[]).map((s) => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>

          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">Toutes les marques</option>
            {BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">Tous les etats</option>
            {(['new', 'like_new', 'good', 'fair', 'poor'] as ProductCondition[]).map((c) => (
              <option key={c} value={c}>{conditionLabels[c]}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
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
              onClick={() => {
                setStatusFilter('');
                setBrandFilter('');
                setConditionFilter('');
                setTypeFilter('');
              }}
              className="col-span-2 text-xs text-[#2AA8DC] py-1"
            >
              Reinitialiser les filtres
            </button>
          )}
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-gray-400 mb-2">
        {total} produit{total !== 1 ? 's' : ''}
      </p>

      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-sm">Aucun produit trouve</p>
        </div>
      ) : (
        <>
          <button onClick={() => fetchProducts(1)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#2AA8DC] mb-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser
          </button>
          {viewMode === 'list' ? (
            /* List view */
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  {selectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelection(p.id)}
                      className="w-5 h-5 rounded border-gray-300 text-[#2AA8DC] focus:ring-[#2AA8DC] flex-shrink-0"
                    />
                  )}
                  <button
                    onClick={() => selectionMode ? toggleSelection(p.id) : setSelectedProduct(p)}
                    className="flex-1 bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 text-left active:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[p.status]}`} />
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {p.brand} {p.model}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {p.storage && (
                          <span className="text-xs text-gray-400">{p.storage}</span>
                        )}
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {conditionLabels[p.condition]}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatPrice(p.selling_price)}</p>
                      <p className="text-[10px] text-gray-400">{statusLabels[p.status]}</p>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            /* Grid view */
            <div className="grid grid-cols-2 gap-2">
              {products.map((p) => (
                <div key={p.id} className="relative">
                  {selectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelection(p.id)}
                      className="absolute top-2 left-2 w-5 h-5 rounded border-gray-300 text-[#2AA8DC] focus:ring-[#2AA8DC] z-10"
                    />
                  )}
                  <button
                    onClick={() => selectionMode ? toggleSelection(p.id) : setSelectedProduct(p)}
                    className="w-full bg-white rounded-xl border border-gray-100 p-3 text-left active:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[p.status]}`} />
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {conditionLabels[p.condition]}
                      </span>
                    </div>
                    <p className="font-medium text-sm text-gray-900 truncate">{p.brand} {p.model}</p>
                    {p.storage && <p className="text-xs text-gray-400 mt-0.5">{p.storage}</p>}
                    <p className="text-sm font-semibold text-gray-900 mt-2">{formatPrice(p.selling_price)}</p>
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={observerRef} className="h-4" />
      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => router.push('/stock/add')}
        className="fixed bottom-24 right-4 w-14 h-14 bg-[#2AA8DC] text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform z-30"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Detail sheet */}
      {selectedProduct && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => { setSelectedProduct(null); setShowTransferConfirm(false); }}
          />
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[80vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-white pt-3 pb-2 px-4 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedProduct.brand} {selectedProduct.model}
                </h2>
                <button onClick={() => { setSelectedProduct(null); setShowTransferConfirm(false); }} className="p-1 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* Status & condition */}
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs text-white ${statusColors[selectedProduct.status]}`}>
                  {statusLabels[selectedProduct.status]}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  {conditionLabels[selectedProduct.condition]}
                </span>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                {selectedProduct.imei && (
                  <DetailItem label="IMEI" value={selectedProduct.imei} />
                )}
                <DetailItem
                  label="Type"
                  value={selectedProduct.product_type === 'phone' ? 'Telephone' : selectedProduct.product_type === 'accessory' ? 'Accessoire' : 'Piece'}
                />
                {selectedProduct.storage && (
                  <DetailItem label="Stockage" value={selectedProduct.storage} />
                )}
                {selectedProduct.color && (
                  <DetailItem label="Couleur" value={selectedProduct.color} />
                )}
                <DetailItem label="Prix d'achat" value={formatPrice(selectedProduct.purchase_price)} />
                <DetailItem label="Prix de vente" value={formatPrice(selectedProduct.selling_price)} />
                {selectedProduct.supplier && (
                  <DetailItem label="Fournisseur" value={selectedProduct.supplier} />
                )}
                {selectedProduct.store?.name && (
                  <DetailItem label="Magasin" value={selectedProduct.store.name} />
                )}
              </div>

              {selectedProduct.notes && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{selectedProduct.notes}</p>
                </div>
              )}

              {/* Transfer button — only for in_stock products and manager/superadmin */}
              {canTransfer && !showTransferConfirm && (
                <button
                  onClick={() => setShowTransferConfirm(true)}
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
                    Transferer vers {getTransferDestination(selectedProduct.store_id).name} ?
                  </p>
                  <p className="text-xs text-orange-600">
                    {selectedProduct.brand} {selectedProduct.model} sera deplace vers le magasin {getTransferDestination(selectedProduct.store_id).name}.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowTransferConfirm(false)}
                      className="flex-1 py-2 px-3 rounded-lg border border-gray-300 text-sm text-gray-600 bg-white"
                      disabled={transferring}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleTransfer}
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
                onClick={() => {
                  setSelectedIds(new Set([selectedProduct.id]));
                  setShowPrintPreview(true);
                  setSelectedProduct(null);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimer l&apos;etiquette
              </button>
            </div>
          </div>
        </>
      )}

      {/* Floating selection action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 bg-white rounded-2xl shadow-lg border border-gray-200 p-3 flex items-center justify-between z-30">
          <span className="text-sm font-medium text-gray-700">
            {selectedIds.size} selectionne{selectedIds.size > 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowPrintPreview(true)}
            className="px-4 py-2 bg-[#2AA8DC] text-white text-sm font-medium rounded-xl active:scale-95 transition-transform"
          >
            Imprimer les etiquettes
          </button>
        </div>
      )}

      {/* Print preview modal */}
      {showPrintPreview && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowPrintPreview(false)} />
          <div className="fixed inset-4 bg-white rounded-2xl z-50 overflow-y-auto flex flex-col">
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Apercu des etiquettes</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#2AA8DC] text-white text-sm font-medium rounded-xl"
                >
                  Imprimer
                </button>
                <button onClick={() => setShowPrintPreview(false)} className="p-1 text-gray-400">
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

      {/* CSV Import Modal */}
      {showCsvModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => !importing && resetCsvModal()} />
          <div className="fixed inset-4 bg-white rounded-2xl z-50 overflow-y-auto flex flex-col">
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Importer CSV</h2>
              <button onClick={() => !importing && resetCsvModal()} className="p-1 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4 flex-1">
              {/* File input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fichier CSV</label>
                <input
                  ref={csvFileRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#2AA8DC] file:text-white hover:file:bg-[#2490c0] file:cursor-pointer"
                />
              </div>

              {/* Preview table */}
              {csvHeaders.length > 0 && (
                <>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Apercu ({Math.min(csvRows.length, 5)} premieres lignes sur {csvRows.length})</p>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            {csvHeaders.map((h, i) => (
                              <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvRows.slice(0, 5).map((row, ri) => (
                            <tr key={ri} className="border-t border-gray-100">
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Column mapping */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Correspondance des colonnes</p>
                    <div className="space-y-2">
                      {csvHeaders.map((h, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 w-32 truncate flex-shrink-0">{h}</span>
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                          <select
                            value={columnMapping[i] || ''}
                            onChange={(e) => {
                              const newMapping = [...columnMapping];
                              newMapping[i] = e.target.value as TargetField;
                              setColumnMapping(newMapping);
                            }}
                            className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
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
                    onClick={handleNormalizeWithAI}
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
                    <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Progression</span>
                        <span className="font-medium text-gray-800">{importProgress.done}/{importProgress.total}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
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
                    onClick={handleCsvImport}
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
      )}

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
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}
