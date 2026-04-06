'use client';

import { useState } from 'react';
import {
  formatDateTime,
  formatPrice,
  formatDate,
  repairStatusLabels,
  repairStatusColors,
} from '@/lib/utils';

interface StatusLog {
  status: string;
  changed_at: string;
  notes: string | null;
}

interface Repair {
  id: string;
  device_brand: string;
  device_model: string;
  problem: string;
  status: string;
  estimated_cost: number | null;
  final_cost: number | null;
  deposit: number | null;
  estimated_completion_date: string | null;
  created_at: string;
  updated_at: string;
  technician_name: string | null;
  status_logs: StatusLog[];
}

export default function TrackPage() {
  const [phone, setPhone] = useState('');
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRepairs([]);
    setSearched(false);

    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.length < 8) {
      setError('Veuillez entrer un numéro de téléphone valide');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/repairs/track?phone=${encodeURIComponent(cleaned)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur lors de la recherche');
      } else {
        setRepairs(data.repairs || []);
        setSearched(true);
      }
    } catch {
      setError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = (dateStr: string | null, status: string) => {
    if (!dateStr || status === 'delivered' || status === 'cancelled' || status === 'ready') return false;
    return new Date(dateStr) < new Date();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-[#2AA8DC] text-white">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold">Corner Mobile</h1>
              <p className="text-white/80 text-sm">Suivi de réparation</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Search form */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Suivre ma réparation
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Entrez votre numéro de téléphone pour consulter l&apos;état de vos réparations.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="06XXXXXXXX"
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#2AA8DC] focus:ring-1 focus:ring-[#2AA8DC] transition"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-[#2AA8DC] hover:bg-[#2AA8DC]/90 text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Recherche...
                </span>
              ) : (
                'Suivre ma réparation'
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {searched && repairs.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-300 font-medium">Aucune réparation trouvée pour ce numéro</p>
            <p className="text-gray-400 text-sm mt-1">Vérifiez le numéro et réessayez</p>
          </div>
        )}

        {repairs.map((repair) => (
          <div key={repair.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 mb-4 overflow-hidden">
            {/* Ready banner */}
            {repair.status === 'ready' && (
              <div className="bg-green-500 text-white px-6 py-4 text-center">
                <p className="font-bold text-lg">Votre appareil est prêt !</p>
                <p className="text-green-100 text-sm mt-1">
                  Rendez-vous chez Corner Mobile pour le récupérer.
                </p>
              </div>
            )}

            <div className="p-6">
              {/* Device + Status */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {repair.device_brand} {repair.device_model}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{repair.problem}</p>
                </div>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white shrink-0 ${
                    repairStatusColors[repair.status] || 'bg-gray-50 dark:bg-slate-9000'
                  }`}
                >
                  {repairStatusLabels[repair.status] || repair.status}
                </span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
                <div>
                  <p className="text-gray-400">Date de dépôt</p>
                  <p className="text-gray-900 dark:text-white font-medium">{formatDate(repair.created_at)}</p>
                </div>

                {repair.estimated_completion_date && (
                  <div>
                    <p className="text-gray-400">Date estimée</p>
                    <p
                      className={`font-medium ${
                        isOverdue(repair.estimated_completion_date, repair.status)
                          ? 'text-red-600'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {formatDate(repair.estimated_completion_date)}
                      {isOverdue(repair.estimated_completion_date, repair.status) && (
                        <span className="text-xs ml-1">(en retard)</span>
                      )}
                    </p>
                  </div>
                )}

                {(repair.final_cost != null || repair.estimated_cost != null) && (
                  <div>
                    <p className="text-gray-400">
                      {repair.final_cost != null ? 'Coût final' : 'Coût estimé'}
                    </p>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {formatPrice(repair.final_cost ?? repair.estimated_cost!)}
                    </p>
                  </div>
                )}

                {repair.deposit != null && repair.deposit > 0 && (
                  <div>
                    <p className="text-gray-400">Acompte versé</p>
                    <p className="text-gray-900 dark:text-white font-medium">{formatPrice(repair.deposit)}</p>
                  </div>
                )}

                {repair.technician_name && (
                  <div>
                    <p className="text-gray-400">Technicien</p>
                    <p className="text-gray-900 dark:text-white font-medium">{repair.technician_name}</p>
                  </div>
                )}
              </div>

              {/* Timeline */}
              {repair.status_logs.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Historique</p>
                  <div className="relative pl-6 border-l-2 border-gray-200 dark:border-slate-600 space-y-4">
                    {repair.status_logs.map((log, i) => {
                      const isLast = i === repair.status_logs.length - 1;
                      return (
                        <div key={i} className="relative">
                          <div
                            className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 border-white ${
                              isLast
                                ? repairStatusColors[log.status] || 'bg-gray-400'
                                : 'bg-gray-300'
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-medium ${
                                  isLast ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {repairStatusLabels[log.status] || log.status}
                              </span>
                              <span className="text-xs text-gray-400">
                                {formatDateTime(log.changed_at)}
                              </span>
                            </div>
                            {log.notes && (
                              <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Footer link */}
        <div className="text-center mt-8">
          <a href="/login" className="text-sm text-gray-400 hover:text-[#2AA8DC] transition">
            Accès employé
          </a>
        </div>
      </main>
    </div>
  );
}
