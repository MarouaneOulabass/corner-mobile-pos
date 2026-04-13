'use client';

import { RepairStatus, ChecklistTemplate } from '@/types';
import RepairChecklist from '@/components/features/RepairChecklist';
import PhotoCapture from '@/components/features/PhotoCapture';
import SignatureCanvas from '@/components/features/SignatureCanvas';
import CollapsibleSection from './CollapsibleSection';

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

interface RepairChecklistPhotosProps {
  repairStatus: RepairStatus;
  checklistTemplate: ChecklistTemplate | null;

  // Pre-repair
  preChecklistValues: Record<string, string>;
  setPreChecklistValues: (v: Record<string, string>) => void;
  prePhotos: string[];
  onPrePhotoCapture: (dataUrl: string) => void;
  onPrePhotoDelete: (index: number) => void;

  // Post-repair
  postChecklistValues: Record<string, string>;
  setPostChecklistValues: (v: Record<string, string>) => void;
  postPhotos: string[];
  onPostPhotoCapture: (dataUrl: string) => void;
  onPostPhotoDelete: (index: number) => void;

  // Checklist save
  savingChecklist: boolean;
  onSaveChecklist: (type: 'pre' | 'post') => void;

  // Signature
  signatureUrl: string | null;
  setSignatureUrl: (url: string | null) => void;
  showSignaturePad: boolean;
  setShowSignaturePad: (show: boolean) => void;
  savingSignature: boolean;
  onSignatureSave: (dataUrl: string) => void;
}

export default function RepairChecklistPhotos({
  repairStatus,
  checklistTemplate,
  preChecklistValues,
  setPreChecklistValues,
  prePhotos,
  onPrePhotoCapture,
  onPrePhotoDelete,
  postChecklistValues,
  setPostChecklistValues,
  postPhotos,
  onPostPhotoCapture,
  onPostPhotoDelete,
  savingChecklist,
  onSaveChecklist,
  signatureUrl,
  setSignatureUrl,
  showSignaturePad,
  setShowSignaturePad,
  savingSignature,
  onSignatureSave,
}: RepairChecklistPhotosProps) {
  const preChecklistEditable =
    repairStatus === 'received' || repairStatus === 'diagnosing';
  const postChecklistEditable = repairStatus === 'ready';

  return (
    <>
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
              onClick={() => onSaveChecklist('pre')}
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
          onCapture={onPrePhotoCapture}
          onDelete={onPrePhotoDelete}
          readOnly={!preChecklistEditable}
          maxPhotos={5}
        />
      </CollapsibleSection>

      {/* Post-repair Checklist */}
      {checklistTemplate && isStatusAtLeast(repairStatus, 'in_repair') && (
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
              onClick={() => onSaveChecklist('post')}
              disabled={savingChecklist}
              className="mt-3 w-full py-2 bg-[#5BBF3E] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
            >
              {savingChecklist ? 'Enregistrement...' : 'Enregistrer checklist'}
            </button>
          )}
        </CollapsibleSection>
      )}

      {/* Post-repair Photos */}
      {isStatusAtLeast(repairStatus, 'in_repair') && (
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
            onCapture={onPostPhotoCapture}
            onDelete={onPostPhotoDelete}
            readOnly={repairStatus === 'delivered' || repairStatus === 'cancelled'}
            maxPhotos={5}
          />
        </CollapsibleSection>
      )}

      {/* Signature (at delivery) */}
      {(repairStatus === 'ready' || repairStatus === 'delivered') && (
        <CollapsibleSection
          title="Signature client"
          icon={
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          }
          defaultOpen={!signatureUrl && repairStatus === 'ready'}
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
              {repairStatus === 'ready' && (
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
              <SignatureCanvas onSave={onSignatureSave} />
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
    </>
  );
}
