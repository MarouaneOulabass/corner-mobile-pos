'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RepairStatus } from '@/types';

import { useRepairDetail } from '@/modules/repairs/hooks/useRepairDetail';
import { useRepairStatus } from '@/modules/repairs/hooks/useRepairStatus';
import { useRepairParts } from '@/modules/repairs/hooks/useRepairParts';

import RepairHeader from '@/modules/repairs/components/RepairHeader';
import RepairCostSummary from '@/modules/repairs/components/RepairCostSummary';
import RepairTimeline from '@/modules/repairs/components/RepairTimeline';
import RepairChecklistPhotos from '@/modules/repairs/components/RepairChecklistPhotos';
import RepairPartsSection from '@/modules/repairs/components/RepairPartsSection';
import RepairStatusActions from '@/modules/repairs/components/RepairStatusActions';
import RepairAIDiagnosis from '@/modules/repairs/components/RepairAIDiagnosis';

export default function RepairDetailPage() {
  useAuth();
  const router = useRouter();
  const params = useParams();
  const repairId = params.id as string;

  const detail = useRepairDetail(repairId);
  const status = useRepairStatus(repairId, detail.repair, detail.setRepair, detail.setError);
  const parts = useRepairParts(repairId, detail.partsUsed, detail.setPartsUsed, detail.fetchParts);

  // Sync finalCost when repair loads
  useEffect(() => {
    if (detail.repair?.final_cost) {
      status.setFinalCost(String(detail.repair.final_cost));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.repair?.final_cost]);

  if (detail.loading) {
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

  if (!detail.repair) {
    return (
      <div className="p-4 text-center py-12">
        <p className="text-gray-400 text-sm">Réparation introuvable</p>
      </div>
    );
  }

  const repair = detail.repair;
  const isOverdue =
    repair.estimated_completion_date &&
    repair.status !== 'delivered' &&
    repair.status !== 'cancelled' &&
    new Date(repair.estimated_completion_date) < new Date();

  return (
    <div className="p-4 space-y-4">
      <RepairHeader
        repair={repair}
        isOverdue={!!isOverdue}
        onBack={() => router.back()}
      />

      <RepairCostSummary
        repair={repair}
        isOverdue={!!isOverdue}
        finalCost={status.finalCost}
        setFinalCost={status.setFinalCost}
        showFinalCost={status.showFinalCost}
        setShowFinalCost={status.setShowFinalCost}
        updating={status.updating}
        onSaveFinalCost={status.handleSaveFinalCost}
      />

      <RepairTimeline statusLogs={repair.status_logs} />

      <RepairChecklistPhotos
        repairStatus={repair.status}
        checklistTemplate={detail.checklistTemplate}
        preChecklistValues={detail.preChecklistValues}
        setPreChecklistValues={detail.setPreChecklistValues}
        prePhotos={detail.prePhotos}
        onPrePhotoCapture={(dataUrl) => detail.handlePhotoCapture('pre', dataUrl)}
        onPrePhotoDelete={(index) => detail.handlePhotoDelete('pre', index)}
        postChecklistValues={detail.postChecklistValues}
        setPostChecklistValues={detail.setPostChecklistValues}
        postPhotos={detail.postPhotos}
        onPostPhotoCapture={(dataUrl) => detail.handlePhotoCapture('post', dataUrl)}
        onPostPhotoDelete={(index) => detail.handlePhotoDelete('post', index)}
        savingChecklist={detail.savingChecklist}
        onSaveChecklist={detail.handleSaveChecklist}
        signatureUrl={detail.signatureUrl}
        setSignatureUrl={detail.setSignatureUrl}
        showSignaturePad={detail.showSignaturePad}
        setShowSignaturePad={detail.setShowSignaturePad}
        savingSignature={detail.savingSignature}
        onSignatureSave={detail.handleSignatureSave}
      />

      <RepairPartsSection
        partsUsed={detail.partsUsed}
        parts={parts}
        repairStatus={repair.status}
      />

      <RepairStatusActions
        status={repair.status}
        customerPhone={repair.customer?.phone}
        customerName={repair.customer?.name}
        deviceModel={repair.device_model}
        updating={status.updating}
        statusNote={status.statusNote}
        setStatusNote={status.setStatusNote}
        onStatusChange={(newStatus: RepairStatus) => status.handleStatusChange(newStatus)}
        error={detail.error}
      />

      <RepairAIDiagnosis repair={repair} />
    </div>
  );
}
