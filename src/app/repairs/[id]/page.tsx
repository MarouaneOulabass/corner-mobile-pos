'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Repair, RepairStatus, ChecklistTemplate, Part, RepairPartUsed } from '@/types';
import {
  formatPrice,
  formatDate,
  formatDateTime,
  repairStatusLabels,
  repairStatusColors,
  validRepairTransitions,
  generateWhatsAppLink,
} from '@/lib/utils';
import RepairChecklist from '@/components/features/RepairChecklist';
import PhotoCapture from '@/components/features/PhotoCapture';
import SignatureCanvas from '@/components/features/SignatureCanvas';

// Collapsible section wrapper
function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
            {title}
          </h2>
          {badge}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// Status ordering for comparisons
const STATUS_ORDER: RepairStatus[] = [
  'received',
  'diagnosing',
  'waiting_parts',
  'in_repair',
  'ready',
  'delivered',
];

function isStatusAtLeast(current: RepairStatus, target: RepairStatus): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(target);
}

export default function RepairDetailPage() {
  useAuth();
  const router = useRouter();
  const params = useParams();
  const repairId = params.id as string;

  const [repair, setRepair] = useState<Repair | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [finalCost, setFinalCost] = useState('');
  const [showFinalCost, setShowFinalCost] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
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
  const [showAddPart, setShowAddPart] = useState(false);
  const [partSearch, setPartSearch] = useState('');
  const [partSearchResults, setPartSearchResults] = useState<Part[]>([]);
  const [searchingParts, setSearchingParts] = useState(false);
  const [addingPart, setAddingPart] = useState(false);
  const [newPartQty, setNewPartQty] = useState('1');
  const [newPartCost, setNewPartCost] = useState('');
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);

  const fetchRepair = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/repairs/${repairId}`);
      if (res.ok) {
        const data: Repair = await res.json();
        setRepair(data);
        if (data.final_cost) setFinalCost(String(data.final_cost));
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
        // Use the first active template
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

  async function handleAiDiagnosis() {
    if (!repair) return;
    setAiLoading(true);
    setAiResult('');

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'repair_diagnosis',
          data: {
            device_brand: repair.device_brand,
            device_model: repair.device_model,
            problem: repair.problem,
            problem_categories: repair.problem_categories,
            condition_on_arrival: repair.condition_on_arrival,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiResult(data.result || data.response || 'Aucune suggestion.');
      } else {
        setAiResult('Erreur lors du diagnostic IA.');
      }
    } catch {
      setAiResult('Erreur de connexion.');
    } finally {
      setAiLoading(false);
    }
  }

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

  // Parts handlers
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
        setSelectedPart(null);
        setPartSearch('');
        setPartSearchResults([]);
        setNewPartQty('1');
        setNewPartCost('');
        setShowAddPart(false);
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

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded w-2/3 mb-2" />
            <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!repair) {
    return (
      <div className="p-4 text-center py-12">
        <p className="text-gray-400 text-sm">Réparation introuvable</p>
      </div>
    );
  }

  const nextStatuses = validRepairTransitions[repair.status] || [];
  const isOverdue =
    repair.estimated_completion_date &&
    repair.status !== 'delivered' &&
    repair.status !== 'cancelled' &&
    new Date(repair.estimated_completion_date) < new Date();

  const whatsAppMessage = `Bonjour ${repair.customer?.name}, votre ${repair.device_model} est prêt à être récupéré chez Corner Mobile. À bientôt !`;

  // Checklist editability
  const preChecklistEditable =
    repair.status === 'received' || repair.status === 'diagnosing';
  const postChecklistEditable = repair.status === 'ready';

  // Parts total
  const partsTotalCost = partsUsed.reduce(
    (sum, p) => sum + p.quantity * p.unit_cost,
    0
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
            {repair.device_brand} {repair.device_model}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{repair.customer?.name}</p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white ${
            repairStatusColors[repair.status] || 'bg-gray-400'
          }`}
        >
          {repairStatusLabels[repair.status] || repair.status}
        </span>
      </div>

      {/* Overdue warning */}
      {isOverdue && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-600 font-medium">
            En retard - Date estimée: {formatDate(repair.estimated_completion_date!)}
          </p>
        </div>
      )}

      {/* Device info */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Appareil</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-400 text-xs">Marque</span>
            <p className="text-gray-900 dark:text-white">{repair.device_brand}</p>
          </div>
          <div>
            <span className="text-gray-400 text-xs">Modèle</span>
            <p className="text-gray-900 dark:text-white">{repair.device_model}</p>
          </div>
          {repair.imei && (
            <div className="col-span-2">
              <span className="text-gray-400 text-xs">IMEI</span>
              <p className="text-gray-900 dark:text-white font-mono text-xs">{repair.imei}</p>
            </div>
          )}
        </div>
      </div>

      {/* Customer */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Client</h2>
        <div className="text-sm">
          <p className="text-gray-900 dark:text-white font-medium">{repair.customer?.name}</p>
          <p className="text-gray-500 dark:text-gray-400">{repair.customer?.phone}</p>
        </div>
      </div>

      {/* Problem */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Problème</h2>
        {repair.problem_categories && repair.problem_categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {repair.problem_categories.map((cat) => (
              <span
                key={cat}
                className="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 text-xs px-2 py-0.5 rounded-full"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm text-gray-700 dark:text-gray-200">{repair.problem}</p>
        {repair.condition_on_arrival && (
          <div className="mt-2">
            <span className="text-gray-400 text-xs">État à l&apos;arrivée</span>
            <p className="text-sm text-gray-700 dark:text-gray-200">{repair.condition_on_arrival}</p>
          </div>
        )}
      </div>

      {/* Costs */}
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
              onClick={handleSaveFinalCost}
              disabled={updating}
              className="px-3 py-2 bg-[#2AA8DC] text-white rounded-lg text-xs font-medium disabled:opacity-50"
            >
              OK
            </button>
          </div>
        )}
      </div>

      {/* Status Timeline */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
          Historique
        </h2>
        {repair.status_logs && repair.status_logs.length > 0 ? (
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-slate-600" />
            <div className="space-y-4">
              {repair.status_logs.map((log, index) => (
                <div key={log.id} className="flex gap-3 relative">
                  <div
                    className={`w-4 h-4 rounded-full shrink-0 mt-0.5 border-2 border-white z-10 ${
                      index === repair.status_logs!.length - 1
                        ? repairStatusColors[log.status] || 'bg-gray-400'
                        : 'bg-gray-300'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {repairStatusLabels[log.status] || log.status}
                      </span>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {formatDateTime(log.changed_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {log.user?.name || 'Système'}
                      {log.notes ? ` - ${log.notes}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Aucun historique</p>
        )}
      </div>

      {/* ============================================================ */}
      {/* PRE-REPAIR: Checklist + Photos                               */}
      {/* ============================================================ */}

      {/* Pre-repair Checklist */}
      {checklistTemplate && (
        <CollapsibleSection
          title="Checklist avant réparation"
          icon={
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
          defaultOpen={preChecklistEditable}
        >
          <RepairChecklist
            template={{ ...checklistTemplate, name: 'Inspection avant réparation' }}
            values={preChecklistValues}
            onChange={setPreChecklistValues}
            readOnly={!preChecklistEditable}
          />
          {preChecklistEditable && (
            <button
              type="button"
              onClick={() => handleSaveChecklist('pre')}
              disabled={savingChecklist}
              className="mt-3 w-full py-2 bg-[#2AA8DC] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
            >
              {savingChecklist ? 'Enregistrement...' : 'Enregistrer checklist'}
            </button>
          )}
        </CollapsibleSection>
      )}

      {/* Pre-repair Photos */}
      <CollapsibleSection
        title="Photos avant réparation"
        icon={
          <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
        badge={
          prePhotos.length > 0 ? (
            <span className="bg-orange-100 text-orange-600 text-xs px-1.5 py-0.5 rounded-full">
              {prePhotos.length}
            </span>
          ) : null
        }
        defaultOpen={preChecklistEditable && prePhotos.length === 0}
      >
        <PhotoCapture
          photos={prePhotos}
          onCapture={(dataUrl) => handlePhotoCapture('pre', dataUrl)}
          onDelete={(index) => handlePhotoDelete('pre', index)}
          readOnly={!preChecklistEditable}
          maxPhotos={5}
        />
      </CollapsibleSection>

      {/* ============================================================ */}
      {/* PARTS USED                                                    */}
      {/* ============================================================ */}

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
                  {repair.status !== 'delivered' && repair.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => handleRemovePart(pu.id)}
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
              <span className="text-sm font-bold text-gray-900 dark:text-white">{formatPrice(partsTotalCost)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-2">Aucune pièce ajoutée</p>
        )}

        {/* Add part button */}
        {repair.status !== 'delivered' && repair.status !== 'cancelled' && (
          <>
            {!showAddPart ? (
              <button
                type="button"
                onClick={() => setShowAddPart(true)}
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
                  value={partSearch}
                  onChange={(e) => handleSearchParts(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
                />

                {/* Search results */}
                {searchingParts && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Recherche...</p>
                )}
                {partSearchResults.length > 0 && !selectedPart && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {partSearchResults.map((part) => (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => {
                          setSelectedPart(part);
                          setNewPartCost(String(part.selling_price));
                          setPartSearchResults([]);
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
                {selectedPart && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded-lg border border-[#2AA8DC]">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedPart.name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedPart(null)}
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
                          value={newPartQty}
                          onChange={(e) => setNewPartQty(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">Coût unitaire (MAD)</label>
                        <input
                          type="number"
                          min="0"
                          value={newPartCost}
                          onChange={(e) => setNewPartCost(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddPart(false);
                          setSelectedPart(null);
                          setPartSearch('');
                          setPartSearchResults([]);
                        }}
                        className="flex-1 py-2 border border-gray-300 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleAddPart}
                        disabled={addingPart}
                        className="flex-1 py-2 bg-[#2AA8DC] text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {addingPart ? 'Ajout...' : 'Ajouter'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Cancel if nothing selected */}
                {!selectedPart && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPart(false);
                      setPartSearch('');
                      setPartSearchResults([]);
                    }}
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

      {/* ============================================================ */}
      {/* POST-REPAIR: Checklist + Photos                              */}
      {/* ============================================================ */}

      {/* Post-repair Checklist */}
      {checklistTemplate && isStatusAtLeast(repair.status, 'in_repair') && (
        <CollapsibleSection
          title="Checklist après réparation"
          icon={
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          defaultOpen={postChecklistEditable}
        >
          <RepairChecklist
            template={{ ...checklistTemplate, name: 'Inspection après réparation' }}
            values={postChecklistValues}
            onChange={setPostChecklistValues}
            readOnly={!postChecklistEditable}
          />
          {postChecklistEditable && (
            <button
              type="button"
              onClick={() => handleSaveChecklist('post')}
              disabled={savingChecklist}
              className="mt-3 w-full py-2 bg-[#5BBF3E] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
            >
              {savingChecklist ? 'Enregistrement...' : 'Enregistrer checklist'}
            </button>
          )}
        </CollapsibleSection>
      )}

      {/* Post-repair Photos */}
      {isStatusAtLeast(repair.status, 'in_repair') && (
        <CollapsibleSection
          title="Photos après réparation"
          icon={
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          badge={
            postPhotos.length > 0 ? (
              <span className="bg-green-100 text-green-600 text-xs px-1.5 py-0.5 rounded-full">
                {postPhotos.length}
              </span>
            ) : null
          }
        >
          <PhotoCapture
            photos={postPhotos}
            onCapture={(dataUrl) => handlePhotoCapture('post', dataUrl)}
            onDelete={(index) => handlePhotoDelete('post', index)}
            readOnly={repair.status === 'delivered' || repair.status === 'cancelled'}
            maxPhotos={5}
          />
        </CollapsibleSection>
      )}

      {/* ============================================================ */}
      {/* SIGNATURE (at delivery)                                       */}
      {/* ============================================================ */}

      {(repair.status === 'ready' || repair.status === 'delivered') && (
        <CollapsibleSection
          title="Signature client"
          icon={
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          }
          defaultOpen={!signatureUrl && repair.status === 'ready'}
          badge={
            signatureUrl ? (
              <span className="bg-indigo-100 text-indigo-600 text-xs px-1.5 py-0.5 rounded-full">
                Signé
              </span>
            ) : null
          }
        >
          {signatureUrl ? (
            <div className="space-y-2">
              <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureUrl}
                  alt="Signature client"
                  className="w-full h-auto max-h-32 object-contain"
                />
              </div>
              <p className="text-xs text-gray-400 text-center">
                Signature enregistrée
              </p>
              {repair.status === 'ready' && (
                <button
                  type="button"
                  onClick={() => {
                    setSignatureUrl(null);
                    setShowSignaturePad(true);
                  }}
                  className="w-full py-1.5 text-xs text-[#2AA8DC] font-medium"
                >
                  Refaire la signature
                </button>
              )}
            </div>
          ) : showSignaturePad ? (
            <div className="space-y-2">
              <SignatureCanvas onSave={handleSignatureSave} />
              {savingSignature && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Enregistrement...</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSignaturePad(true)}
              className="w-full py-3 border-2 border-dashed border-indigo-300 text-indigo-500 rounded-lg text-sm font-medium hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              Ouvrir le pad de signature
            </button>
          )}
        </CollapsibleSection>
      )}

      {/* ============================================================ */}
      {/* EXISTING BOTTOM SECTIONS                                      */}
      {/* ============================================================ */}

      {/* WhatsApp button when ready */}
      {repair.status === 'ready' && repair.customer?.phone && (
        <a
          href={generateWhatsAppLink(repair.customer.phone, whatsAppMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] text-white font-semibold rounded-xl text-sm hover:bg-[#20bd5a] active:scale-[0.98] transition-all"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Notifier via WhatsApp
        </a>
      )}

      {/* Status transition buttons */}
      {nextStatuses.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
            Changer le statut
          </h2>
          <input
            type="text"
            placeholder="Note (optionnel)"
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
          />
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status as RepairStatus)}
                disabled={updating}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-50 ${
                  status === 'cancelled'
                    ? 'bg-red-500 hover:bg-red-600'
                    : repairStatusColors[status] || 'bg-gray-50 dark:bg-slate-9000'
                } hover:opacity-90`}
              >
                {repairStatusLabels[status] || status}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI Diagnosis */}
      {repair.status !== 'delivered' && repair.status !== 'cancelled' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 space-y-3">
          <button
            onClick={handleAiDiagnosis}
            disabled={aiLoading}
            className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold rounded-xl text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {aiLoading ? 'Analyse en cours...' : 'Demander diagnostic IA'}
          </button>
          {aiResult && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-purple-700 mb-1">Diagnostic IA</p>
              <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{aiResult}</p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
