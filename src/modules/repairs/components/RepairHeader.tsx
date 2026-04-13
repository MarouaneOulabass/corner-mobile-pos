'use client';

import { Repair } from '@/types';
import {
  repairStatusLabels,
  repairStatusColors,
  formatDate,
} from '@/lib/utils';

interface RepairHeaderProps {
  repair: Repair;
  isOverdue: boolean;
  onBack: () => void;
}

export default function RepairHeader({ repair, isOverdue, onBack }: RepairHeaderProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
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
    </>
  );
}
