'use client';

import { useState } from 'react';
import { Repair, RepairStatus } from '@/types';

export interface RepairStatusState {
  updating: boolean;
  statusNote: string;
  setStatusNote: (note: string) => void;
  finalCost: string;
  setFinalCost: (cost: string) => void;
  showFinalCost: boolean;
  setShowFinalCost: (show: boolean) => void;
  handleStatusChange: (newStatus: RepairStatus) => Promise<void>;
  handleSaveFinalCost: () => Promise<void>;
}

export function useRepairStatus(
  repairId: string,
  repair: Repair | null,
  setRepair: (repair: Repair | null) => void,
  setError: (error: string) => void,
): RepairStatusState {
  const [updating, setUpdating] = useState(false);
  const [finalCost, setFinalCost] = useState('');
  const [showFinalCost, setShowFinalCost] = useState(false);
  const [statusNote, setStatusNote] = useState('');

  // Sync finalCost when repair loads with a final_cost
  // This is handled by the caller setting finalCost after fetch

  async function handleStatusChange(newStatus: RepairStatus) {
    if (!repair) return;
    setError('');
    setUpdating(true);

    const body: Record<string, unknown> = {
      status: newStatus,
      status_note: statusNote || undefined,
    };

    // If completing and final cost is set
    if (newStatus === 'delivered' && finalCost) {
      body.final_cost = parseFloat(finalCost);
    }

    try {
      const res = await fetch(`/api/repairs/${repairId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setRepair(data);
        setStatusNote('');
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la mise à jour.');
      }
    } catch {
      setError('Erreur de connexion.');
    } finally {
      setUpdating(false);
    }
  }

  async function handleSaveFinalCost() {
    if (!repair || !finalCost) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/repairs/${repairId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_cost: parseFloat(finalCost) }),
      });
      if (res.ok) {
        const data = await res.json();
        setRepair(data);
        setShowFinalCost(false);
      }
    } catch {
      // silent
    } finally {
      setUpdating(false);
    }
  }

  return {
    updating,
    statusNote,
    setStatusNote,
    finalCost,
    setFinalCost,
    showFinalCost,
    setShowFinalCost,
    handleStatusChange,
    handleSaveFinalCost,
  };
}
