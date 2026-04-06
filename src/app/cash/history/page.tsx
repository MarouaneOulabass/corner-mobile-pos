'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CashSession, CashMovement } from '@/types';
import { formatPrice, formatDateTime, formatDate, cashMovementLabels, cashMovementColors } from '@/lib/utils';
import Link from 'next/link';

export default function CashHistoryPage() {
  const { user } = useAuth();

  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Detail view
  const [selectedSession, setSelectedSession] = useState<(CashSession & { movements?: CashMovement[] }) | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: 'closed' });
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/cash/sessions?${params}`);
      if (!res.ok) throw new Error('Erreur');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [user, dateFrom, dateTo]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleViewDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/cash/sessions/${id}`);
      if (res.ok) {
        setSelectedSession(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/cash" className="text-gray-500">&larr;</Link>
          <h1 className="text-lg font-bold text-gray-900">Historique Caisse</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Date filters */}
        <div className="bg-white rounded-xl shadow-sm p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Du</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Au</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Detail modal */}
        {selectedSession && (
          <div className="bg-white rounded-xl shadow-sm p-4 border-2 border-[#2AA8DC] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Session du {formatDate(selectedSession.opened_at)}
              </h3>
              <button onClick={() => setSelectedSession(null)} className="text-gray-400 text-lg">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-500">Ouverture</p>
                <p className="font-medium">{formatPrice(selectedSession.opening_amount)}</p>
              </div>
              <div>
                <p className="text-gray-500">Fermeture</p>
                <p className="font-medium">{formatPrice(selectedSession.closing_amount || 0)}</p>
              </div>
              <div>
                <p className="text-gray-500">Attendu</p>
                <p className="font-medium">{formatPrice(selectedSession.expected_amount || 0)}</p>
              </div>
              <div>
                <p className="text-gray-500">Difference</p>
                <p className={`font-semibold ${(selectedSession.difference || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPrice(selectedSession.difference || 0)}
                </p>
              </div>
            </div>

            {loadingDetail ? (
              <div className="text-center text-sm text-gray-400">Chargement...</div>
            ) : (
              <>
                <h4 className="text-sm font-medium text-gray-700 mt-2">Mouvements</h4>
                {(!selectedSession.movements || selectedSession.movements.length === 0) ? (
                  <p className="text-sm text-gray-400 text-center">Aucun mouvement</p>
                ) : (
                  <div className="divide-y max-h-60 overflow-y-auto">
                    {selectedSession.movements.map((m) => (
                      <div key={m.id} className="py-2 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{cashMovementLabels[m.type] || m.type}</p>
                          <p className="text-xs text-gray-500">{m.reason || '-'}</p>
                        </div>
                        <span className={`text-sm font-semibold ${cashMovementColors[m.type] || 'text-gray-600'}`}>
                          {m.type === 'expense' || m.type === 'withdrawal' || m.type === 'return' ? '-' : '+'}
                          {formatPrice(m.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Sessions list */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2AA8DC] mx-auto"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Aucune session trouvee
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => handleViewDetail(s.id)}
                className="w-full bg-white rounded-xl shadow-sm p-4 text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {formatDate(s.opened_at)}
                  </span>
                  <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">
                    Fermee
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Ouvert par</p>
                    <p className="font-medium">{s.opener?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Ouverture</p>
                    <p className="font-medium">{formatPrice(s.opening_amount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Fermeture</p>
                    <p className="font-medium">{formatPrice(s.closing_amount || 0)}</p>
                  </div>
                </div>
                <div className="mt-2 text-right">
                  <span className="text-xs text-gray-500">Diff: </span>
                  <span className={`text-xs font-semibold ${(s.difference || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(s.difference || 0) >= 0 ? '+' : ''}{formatPrice(s.difference || 0)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
