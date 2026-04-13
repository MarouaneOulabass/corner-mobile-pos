'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Product } from '@/types';

export interface UseProductActionsReturn {
  // Selection
  selectionMode: boolean;
  selectedIds: Set<string>;
  toggleSelectionMode: () => void;
  toggleSelection: (id: string) => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Detail sheet
  selectedProduct: Product | null;
  setSelectedProduct: (p: Product | null) => void;

  // Transfer
  showTransferConfirm: boolean;
  setShowTransferConfirm: (v: boolean) => void;
  transferring: boolean;
  transferMessage: string | null;
  canTransfer: boolean;
  handleTransfer: (stores: { id: string; name: string }[]) => Promise<void>;
  getTransferDestination: (currentStoreId: string, stores: { id: string; name: string }[]) => { id: string; name: string };

  // Print preview
  showPrintPreview: boolean;
  setShowPrintPreview: (v: boolean) => void;

  // Stores
  stores: { id: string; name: string }[];
  fetchStores: () => void;

  // Refresh callback
  onRefresh: (() => void) | null;
  setOnRefresh: (fn: (() => void) | null) => void;
}

export function useProductActions(): UseProductActionsReturn {
  const { user } = useAuth();

  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);

  // Selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Detail sheet
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Transfer
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);

  // Print preview
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Refresh callback
  const [onRefresh, setOnRefresh] = useState<(() => void) | null>(null);

  const fetchStores = () => {
    fetch('/api/stores')
      .then((r) => r.json())
      .then((data) => {
        if (data.stores)
          setStores(data.stores.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
      })
      .catch(() => {});
  };

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getTransferDestination = (currentStoreId: string, storeList: { id: string; name: string }[]) => {
    const other = storeList.find((s) => s.id !== currentStoreId);
    return other || storeList[0] || { id: '', name: 'Autre magasin' };
  };

  const handleTransfer = async (storeList: { id: string; name: string }[]) => {
    if (!user || !selectedProduct) return;
    setTransferring(true);
    const dest = getTransferDestination(selectedProduct.store_id, storeList);
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          to_store_id: dest.id,
        }),
      });
      if (res.ok) {
        setTransferMessage(`Produit transfere vers ${dest.name} avec succes`);
        setShowTransferConfirm(false);
        setSelectedProduct(null);
        onRefresh?.();
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

  const canTransfer =
    !!user && (user.role === 'manager' || user.role === 'superadmin') && selectedProduct?.status === 'in_stock';

  return {
    selectionMode,
    selectedIds,
    toggleSelectionMode,
    toggleSelection,
    setSelectedIds,
    selectedProduct,
    setSelectedProduct,
    showTransferConfirm,
    setShowTransferConfirm,
    transferring,
    transferMessage,
    canTransfer,
    handleTransfer,
    getTransferDestination,
    showPrintPreview,
    setShowPrintPreview,
    stores,
    fetchStores,
    onRefresh,
    setOnRefresh,
  };
}
