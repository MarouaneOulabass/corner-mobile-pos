'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

import { useProductList } from '@/modules/inventory/hooks/useProductList';
import { useProductActions } from '@/modules/inventory/hooks/useProductActions';
import { useCsvImport } from '@/modules/inventory/hooks/useCsvImport';
import { TargetField } from '@/modules/inventory/hooks/useCsvImport';

import ProductList from '@/modules/inventory/components/ProductList';
import ProductGrid from '@/modules/inventory/components/ProductGrid';
import ProductFilters from '@/modules/inventory/components/ProductFilters';
import StockStats from '@/modules/inventory/components/StockStats';
import BulkActions from '@/modules/inventory/components/BulkActions';
import CsvImportDialog from '@/modules/inventory/components/CsvImportDialog';
import ProductDetailSheet from '@/modules/inventory/components/ProductDetailSheet';

export default function StockPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const list = useProductList();
  const actions = useProductActions();

  const refreshList = useCallback(() => list.fetchProducts(1), [list.fetchProducts]);

  const csv = useCsvImport(refreshList);

  // Fetch stores on mount & wire refresh callback
  useEffect(() => {
    actions.fetchStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    actions.setOnRefresh(() => refreshList);
  }, [refreshList, actions.setOnRefresh]);

  const handlePrintLabelFromDetail = () => {
    if (!actions.selectedProduct) return;
    actions.setSelectedIds(new Set([actions.selectedProduct.id]));
    actions.setShowPrintPreview(true);
    actions.setSelectedProduct(null);
  };

  const transferDestName = actions.selectedProduct
    ? actions.getTransferDestination(actions.selectedProduct.store_id, actions.stores).name
    : '';

  return (
    <div className="px-4 pt-4">
      {list.error && (
        <div className="mx-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm mb-3">
          {list.error}{' '}
          <button onClick={() => { list.clearError(); refreshList(); }} className="ml-2 underline">Ressayer</button>
        </div>
      )}

      {actions.transferMessage && (
        <div className={`mx-4 p-3 rounded-xl text-sm mb-3 ${actions.transferMessage.startsWith('Erreur') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {actions.transferMessage}
        </div>
      )}

      {/* Search bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="IMEI, modele, marque..."
            value={list.filters.search}
            onChange={(e) => list.setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
          />
        </div>

        {/* CSV Import button */}
        <button onClick={() => csv.setShowCsvModal(true)} className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400" title="Importer CSV">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`relative p-2.5 rounded-xl border ${
            showFilters || list.activeFilterCount > 0
              ? 'bg-[#2AA8DC] text-white border-[#2AA8DC]'
              : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-600'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {list.activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
              {list.activeFilterCount}
            </span>
          )}
        </button>

        {/* Selection toggle */}
        <button
          onClick={actions.toggleSelectionMode}
          className={`px-2.5 py-2 rounded-xl border text-xs font-medium ${
            actions.selectionMode
              ? 'bg-[#2AA8DC] text-white border-[#2AA8DC]'
              : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-600'
          }`}
        >
          Selectionner
        </button>

        {/* View toggle */}
        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400"
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
        <ProductFilters
          statusFilter={list.filters.statusFilter}
          brandFilter={list.filters.brandFilter}
          conditionFilter={list.filters.conditionFilter}
          typeFilter={list.filters.typeFilter}
          activeFilterCount={list.activeFilterCount}
          onStatusChange={list.setStatusFilter}
          onBrandChange={list.setBrandFilter}
          onConditionChange={list.setConditionFilter}
          onTypeChange={list.setTypeFilter}
          onClearFilters={list.clearFilters}
        />
      )}

      <StockStats total={list.total} />

      {/* Loading / empty / content */}
      {list.loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : list.products.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-sm">Aucun produit trouve</p>
        </div>
      ) : (
        <>
          <button onClick={refreshList} className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#2AA8DC] mb-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser
          </button>
          {viewMode === 'list' ? (
            <ProductList
              products={list.products}
              selectionMode={actions.selectionMode}
              selectedIds={actions.selectedIds}
              onToggleSelection={actions.toggleSelection}
              onSelectProduct={actions.setSelectedProduct}
            />
          ) : (
            <ProductGrid
              products={list.products}
              selectionMode={actions.selectionMode}
              selectedIds={actions.selectedIds}
              onToggleSelection={actions.toggleSelection}
              onSelectProduct={actions.setSelectedProduct}
            />
          )}
        </>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={list.observerRef} className="h-4" />
      {list.loadingMore && (
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
      {actions.selectedProduct && (
        <ProductDetailSheet
          product={actions.selectedProduct}
          canTransfer={actions.canTransfer}
          showTransferConfirm={actions.showTransferConfirm}
          transferring={actions.transferring}
          transferDestinationName={transferDestName}
          onClose={() => { actions.setSelectedProduct(null); actions.setShowTransferConfirm(false); }}
          onTransferClick={() => actions.setShowTransferConfirm(true)}
          onTransferCancel={() => actions.setShowTransferConfirm(false)}
          onTransferConfirm={() => actions.handleTransfer(actions.stores)}
          onPrintLabel={handlePrintLabelFromDetail}
        />
      )}

      {/* Bulk actions & print preview */}
      <BulkActions
        selectionMode={actions.selectionMode}
        selectedIds={actions.selectedIds}
        showPrintPreview={actions.showPrintPreview}
        products={list.products}
        onOpenPrintPreview={() => actions.setShowPrintPreview(true)}
        onClosePrintPreview={() => actions.setShowPrintPreview(false)}
      />

      {/* CSV Import Modal */}
      {csv.showCsvModal && (
        <CsvImportDialog
          csvHeaders={csv.csvHeaders}
          csvRows={csv.csvRows}
          columnMapping={csv.columnMapping}
          onMappingChange={(index: number, value: TargetField) => {
            csv.setColumnMapping((prev) => {
              const next = [...prev];
              next[index] = value;
              return next;
            });
          }}
          importProgress={csv.importProgress}
          importing={csv.importing}
          normalizing={csv.normalizing}
          csvFileRef={csv.csvFileRef}
          onFileChange={csv.handleCsvFileChange}
          onNormalizeWithAI={csv.handleNormalizeWithAI}
          onImport={csv.handleCsvImport}
          onClose={csv.resetCsvModal}
        />
      )}
    </div>
  );
}
