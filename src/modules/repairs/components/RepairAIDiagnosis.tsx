'use client';

import { useState } from 'react';
import { Repair } from '@/types';

interface RepairAIDiagnosisProps {
  repair: Repair;
}

export default function RepairAIDiagnosis({ repair }: RepairAIDiagnosisProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');

  async function handleAiDiagnosis() {
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

  if (repair.status === 'delivered' || repair.status === 'cancelled') {
    return null;
  }

  return (
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
  );
}
