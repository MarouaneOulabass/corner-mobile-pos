'use client';

import { RepairStatusLog } from '@/types';
import {
  repairStatusLabels,
  repairStatusColors,
  formatDateTime,
} from '@/lib/utils';

interface RepairTimelineProps {
  statusLogs: RepairStatusLog[] | undefined;
}

export default function RepairTimeline({ statusLogs }: RepairTimelineProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
        Historique
      </h2>
      {statusLogs && statusLogs.length > 0 ? (
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-slate-600" />
          <div className="space-y-4">
            {statusLogs.map((log, index) => (
              <div key={log.id} className="flex gap-3 relative">
                <div
                  className={`w-4 h-4 rounded-full shrink-0 mt-0.5 border-2 border-white z-10 ${
                    index === statusLogs.length - 1
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
  );
}
