'use client';

import { TradeIn, TradeInStatus } from '@/types';

interface RefurbishmentPipelineProps {
  tradeIn: TradeIn;
  onStatusChange: (status: string) => void;
}

const PIPELINE_STEPS: { status: TradeInStatus; label: string; icon: string }[] = [
  { status: 'accepted', label: 'Accepte', icon: '\u2705' },
  { status: 'in_refurbishment', label: 'Remise en etat', icon: '\uD83D\uDD27' },
  { status: 'listed', label: 'En vente', icon: '\uD83C\uDFF7\uFE0F' },
  { status: 'sold', label: 'Vendu', icon: '\uD83D\uDCB0' },
];

const STATUS_INDEX: Record<string, number> = {
  accepted: 0,
  in_refurbishment: 1,
  listed: 2,
  sold: 3,
};

function getNextStatus(current: TradeInStatus): TradeInStatus | null {
  const map: Record<string, TradeInStatus> = {
    accepted: 'in_refurbishment',
    in_refurbishment: 'listed',
    listed: 'sold',
  };
  return map[current] || null;
}

function getNextActionLabel(current: TradeInStatus): string | null {
  const map: Record<string, string> = {
    accepted: 'Demarrer la remise en etat',
    in_refurbishment: 'Mettre en vente',
    listed: 'Marquer comme vendu',
  };
  return map[current] || null;
}

export default function RefurbishmentPipeline({
  tradeIn,
  onStatusChange,
}: RefurbishmentPipelineProps) {
  const currentIndex = STATUS_INDEX[tradeIn.status] ?? -1;
  const nextStatus = getNextStatus(tradeIn.status);
  const nextLabel = getNextActionLabel(tradeIn.status);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">Pipeline de remise en etat</h3>

      {/* Steps */}
      <div className="flex items-center justify-between mb-6">
        {PIPELINE_STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isFuture = idx > currentIndex;

          return (
            <div key={step.status} className="flex-1 flex flex-col items-center relative">
              {/* Connector line */}
              {idx > 0 && (
                <div
                  className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                    idx <= currentIndex ? 'bg-[#2AA8DC]' : 'bg-gray-200'
                  }`}
                  style={{ zIndex: 0 }}
                />
              )}

              {/* Circle */}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  isCompleted
                    ? 'bg-[#5BBF3E] text-white'
                    : isCurrent
                    ? 'bg-[#2AA8DC] text-white ring-4 ring-[#2AA8DC]/20'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {isCompleted ? '\u2713' : step.icon}
              </div>

              {/* Label */}
              <span
                className={`text-xs mt-1.5 text-center leading-tight ${
                  isCurrent ? 'font-semibold text-[#2AA8DC]' : isFuture ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Action button */}
      {nextStatus && nextLabel && (
        <button
          type="button"
          onClick={() => onStatusChange(nextStatus)}
          className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-colors"
          style={{ backgroundColor: '#2AA8DC' }}
        >
          {nextLabel}
        </button>
      )}

      {tradeIn.status === 'sold' && (
        <div className="text-center py-3 text-[#5BBF3E] font-semibold text-sm">
          Pipeline termine - appareil vendu
        </div>
      )}

      {/* Status history */}
      {tradeIn.updated_at && (
        <p className="text-xs text-gray-400 text-center mt-3">
          Derniere mise a jour : {new Date(tradeIn.updated_at).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  );
}
