'use client';

import { useEffect, useState, useCallback } from 'react';
import { Repair, ChecklistTemplate, RepairPartUsed } from '@/types';

export interface RepairDetailState {
  repair: Repair | null;
  loading: boolean;
  error: string;
  setError: (error: string) => void;
  setRepair: (repair: Repair | null) => void;

  // Checklist
  checklistTemplate: ChecklistTemplate | null;
  preChecklistValues: Record<string, string>;
  setPreChecklistValues: (v: Record<string, string>) => void;
  postChecklistValues: Record<string, string>;
  setPostChecklistValues: (v: Record<string, string>) => void;
  savingChecklist: boolean;
  handleSaveChecklist: (type: 'pre' | 'post') => Promise<void>;

  // Photos
  prePhotos: string[];
  postPhotos: string[];
  handlePhotoCapture: (type: 'pre' | 'post', dataUrl: string) => Promise<void>;
  handlePhotoDelete: (type: 'pre' | 'post', index: number) => Promise<void>;

  // Signature
  signatureUrl: string | null;
  setSignatureUrl: (url: string | null) => void;
  showSignaturePad: boolean;
  setShowSignaturePad: (show: boolean) => void;
  savingSignature: boolean;
  handleSignatureSave: (dataUrl: string) => Promise<void>;

  // Parts
  partsUsed: RepairPartUsed[];
  setPartsUsed: React.Dispatch<React.SetStateAction<RepairPartUsed[]>>;
  fetchParts: () => Promise<void>;

  // Refresh
  fetchRepair: () => Promise<void>;
}

export function useRepairDetail(repairId: string): RepairDetailState {
  const [repair, setRepair] = useState<Repair | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Checklist state
  const [checklistTemplate, setChecklistTemplate] = useState<ChecklistTemplate | null>(null);
  const [preChecklistValues, setPreChecklistValues] = useState<Record<string, string>>({});
  const [postChecklistValues, setPostChecklistValues] = useState<Record<string, string>>({});
  const [savingChecklist, setSavingChecklist] = useState(false);

  // Photos state
  const [prePhotos, setPrePhotos] = useState<string[]>([]);
  const [postPhotos, setPostPhotos] = useState<string[]>([]);

  // Signature state
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [savingSignature, setSavingSignature] = useState(false);

  // Parts state
  const [partsUsed, setPartsUsed] = useState<RepairPartUsed[]>([]);

  const fetchRepair = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/repairs/${repairId}`);
      if (res.ok) {
        const data: Repair = await res.json();
        setRepair(data);
        // Load checklist values from repair data
        if (data.pre_checklist) setPreChecklistValues(data.pre_checklist);
        if (data.post_checklist) setPostChecklistValues(data.post_checklist);
        // Load photos
        if (data.pre_photos) setPrePhotos(data.pre_photos);
        if (data.post_photos) setPostPhotos(data.post_photos);
        // Load signature
        if (data.signature_url) setSignatureUrl(data.signature_url);
        // Load parts
        if (data.parts_used) setPartsUsed(data.parts_used);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [repairId]);

  const fetchChecklistTemplate = useCallback(async () => {
    try {
      const res = await fetch('/api/checklists/templates');
      if (res.ok) {
        const data = await res.json();
        const templates: ChecklistTemplate[] = Array.isArray(data) ? data : data.templates || [];
        const active = templates.find((t) => t.active);
        if (active) setChecklistTemplate(active);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchParts = useCallback(async () => {
    try {
      const res = await fetch(`/api/repairs/${repairId}/parts`);
      if (res.ok) {
        const data = await res.json();
        setPartsUsed(Array.isArray(data) ? data : data.parts || []);
      }
    } catch {
      // silent
    }
  }, [repairId]);

  useEffect(() => {
    fetchRepair();
    fetchChecklistTemplate();
    fetchParts();
  }, [fetchRepair, fetchChecklistTemplate, fetchParts]);

  // Checklist save handler
  async function handleSaveChecklist(type: 'pre' | 'post') {
    setSavingChecklist(true);
    const values = type === 'pre' ? preChecklistValues : postChecklistValues;
    try {
      await fetch(`/api/repairs/${repairId}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, values }),
      });
    } catch {
      // silent
    } finally {
      setSavingChecklist(false);
    }
  }

  // Photo handlers
  async function handlePhotoCapture(type: 'pre' | 'post', dataUrl: string) {
    try {
      const res = await fetch(`/api/repairs/${repairId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, photo: dataUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        const url = data.url || dataUrl;
        if (type === 'pre') {
          setPrePhotos((prev) => [...prev, url]);
        } else {
          setPostPhotos((prev) => [...prev, url]);
        }
      }
    } catch {
      // Fallback: add locally
      if (type === 'pre') {
        setPrePhotos((prev) => [...prev, dataUrl]);
      } else {
        setPostPhotos((prev) => [...prev, dataUrl]);
      }
    }
  }

  async function handlePhotoDelete(type: 'pre' | 'post', index: number) {
    try {
      await fetch(`/api/repairs/${repairId}/photos?type=${type}&index=${index}`, {
        method: 'DELETE',
      });
    } catch {
      // silent
    }
    if (type === 'pre') {
      setPrePhotos((prev) => prev.filter((_, i) => i !== index));
    } else {
      setPostPhotos((prev) => prev.filter((_, i) => i !== index));
    }
  }

  // Signature handler
  async function handleSignatureSave(dataUrl: string) {
    setSavingSignature(true);
    try {
      const res = await fetch('/api/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repair_id: repairId, signature: dataUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setSignatureUrl(data.url || dataUrl);
        setShowSignaturePad(false);
      }
    } catch {
      // Fallback: save locally
      setSignatureUrl(dataUrl);
      setShowSignaturePad(false);
    } finally {
      setSavingSignature(false);
    }
  }

  return {
    repair,
    loading,
    error,
    setError,
    setRepair,
    checklistTemplate,
    preChecklistValues,
    setPreChecklistValues,
    postChecklistValues,
    setPostChecklistValues,
    savingChecklist,
    handleSaveChecklist,
    prePhotos,
    postPhotos,
    handlePhotoCapture,
    handlePhotoDelete,
    signatureUrl,
    setSignatureUrl,
    showSignaturePad,
    setShowSignaturePad,
    savingSignature,
    handleSignatureSave,
    partsUsed,
    setPartsUsed,
    fetchParts,
    fetchRepair,
  };
}
