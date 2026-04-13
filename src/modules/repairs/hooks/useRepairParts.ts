'use client';

import { useState } from 'react';
import { Part, RepairPartUsed } from '@/types';

export interface RepairPartsState {
  showAddPart: boolean;
  setShowAddPart: (show: boolean) => void;
  partSearch: string;
  partSearchResults: Part[];
  searchingParts: boolean;
  addingPart: boolean;
  newPartQty: string;
  setNewPartQty: (qty: string) => void;
  newPartCost: string;
  setNewPartCost: (cost: string) => void;
  selectedPart: Part | null;
  setSelectedPart: (part: Part | null) => void;
  handleSearchParts: (query: string) => Promise<void>;
  handleAddPart: () => Promise<void>;
  handleRemovePart: (partUsedId: string) => Promise<void>;
  resetAddPartForm: () => void;
  partsTotalCost: number;
}

export function useRepairParts(
  repairId: string,
  partsUsed: RepairPartUsed[],
  setPartsUsed: React.Dispatch<React.SetStateAction<RepairPartUsed[]>>,
  fetchParts: () => Promise<void>,
): RepairPartsState {
  const [showAddPart, setShowAddPart] = useState(false);
  const [partSearch, setPartSearch] = useState('');
  const [partSearchResults, setPartSearchResults] = useState<Part[]>([]);
  const [searchingParts, setSearchingParts] = useState(false);
  const [addingPart, setAddingPart] = useState(false);
  const [newPartQty, setNewPartQty] = useState('1');
  const [newPartCost, setNewPartCost] = useState('');
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);

  const partsTotalCost = partsUsed.reduce(
    (sum, p) => sum + p.quantity * p.unit_cost,
    0
  );

  function resetAddPartForm() {
    setShowAddPart(false);
    setSelectedPart(null);
    setPartSearch('');
    setPartSearchResults([]);
    setNewPartQty('1');
    setNewPartCost('');
  }

  async function handleSearchParts(query: string) {
    setPartSearch(query);
    if (query.length < 2) {
      setPartSearchResults([]);
      return;
    }
    setSearchingParts(true);
    try {
      const res = await fetch(`/api/parts?search=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setPartSearchResults(Array.isArray(data) ? data : data.parts || []);
      }
    } catch {
      // silent
    } finally {
      setSearchingParts(false);
    }
  }

  async function handleAddPart() {
    if (!selectedPart) return;
    setAddingPart(true);
    try {
      const res = await fetch(`/api/repairs/${repairId}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part_id: selectedPart.id,
          quantity: parseInt(newPartQty) || 1,
          unit_cost: parseFloat(newPartCost) || selectedPart.selling_price,
        }),
      });
      if (res.ok) {
        await fetchParts();
        resetAddPartForm();
      }
    } catch {
      // silent
    } finally {
      setAddingPart(false);
    }
  }

  async function handleRemovePart(partUsedId: string) {
    try {
      await fetch(`/api/repairs/${repairId}/parts?id=${partUsedId}`, {
        method: 'DELETE',
      });
      setPartsUsed((prev) => prev.filter((p) => p.id !== partUsedId));
    } catch {
      // silent
    }
  }

  return {
    showAddPart,
    setShowAddPart,
    partSearch,
    partSearchResults,
    searchingParts,
    addingPart,
    newPartQty,
    setNewPartQty,
    newPartCost,
    setNewPartCost,
    selectedPart,
    setSelectedPart,
    handleSearchParts,
    handleAddPart,
    handleRemovePart,
    resetAddPartForm,
    partsTotalCost,
  };
}
