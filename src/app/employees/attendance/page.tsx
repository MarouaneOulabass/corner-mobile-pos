'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ClockRecord, User } from '@/types';
import { formatDate, formatHours } from '@/lib/utils';

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  return {
    from: monday.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

export default function AttendancePage() {
  const { user, activeStoreId } = useAuth();
  const [records, setRecords] = useState<ClockRecord[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('');
  const [dateFrom, setDateFrom] = useState(weekRange().from);
  const [dateTo, setDateTo] = useState(weekRange().to);
  const [totals, setTotals] = useState({ total_hours: 0, days_worked: 0, record_count: 0 });

  const fetchRecords = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterUser) params.set('user_id', filterUser);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/clock/history?${params}`);
      const data = await res.json();
      setRecords(data.records || []);
      setTotals(data.totals || { total_hours: 0, days_worked: 0, record_count: 0 });
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [user, filterUser, dateFrom, dateTo]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    if (!user) return;
    import('@/lib/supabase').then(({ supabase }) => {
      const query = supabase.from('users').select('id, name, role, store_id');
      if (activeStoreId) {
        query.eq('store_id', activeStoreId);
      } else if (user.role !== 'superadmin') {
        query.eq('store_id', user.store_id);
      }
      query.then(({ data }) => setEmployees((data as User[]) || []));
    });
  }, [user]);

  if (!user || (user.role !== 'superadmin' && user.role !== 'manager')) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        Acces reserve aux managers
      </div>
    );
  }

  // Group by employee
  const byEmployee = new Map<string, { name: string; hours: number; days: Set<string>; records: ClockRecord[] }>();
  for (const r of records) {
    const name = r.user?.name || 'Inconnu';
    const existing = byEmployee.get(r.user_id) || { name, hours: 0, days: new Set<string>(), records: [] };
    existing.hours += r.total_hours || 0;
    existing.days.add(new Date(r.clock_in).toISOString().slice(0, 10));
    existing.records.push(r);
    byEmployee.set(r.user_id, existing);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20">
      {/* Header */}
      <div className="bg-[#2AA8DC] text-white p-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold">Presence</h1>
          <p className="text-sm opacity-80">Suivi des heures employes</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total heures</p>
            <p className="text-lg font-bold text-[#2AA8DC]">{formatHours(totals.total_hours)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Jours travailles</p>
            <p className="text-lg font-bold">{totals.days_worked}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Pointages</p>
            <p className="text-lg font-bold">{totals.record_count}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="w-full border rounded-lg p-2 text-sm"
          >
            <option value="">Tous les employes</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded-lg p-2 text-sm"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded-lg p-2 text-sm"
            />
          </div>
        </div>

        {/* Per-Employee Summary */}
        {byEmployee.size > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <h3 className="font-medium text-sm mb-3">Resume par employe</h3>
            <div className="space-y-2">
              {Array.from(byEmployee.entries()).map(([uid, s]) => (
                <div key={uid} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                  <span className="font-medium">{s.name}</span>
                  <div className="text-right text-xs">
                    <p className="font-bold">{formatHours(s.hours)}</p>
                    <p className="text-gray-400">{s.days.size} jours</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Records Table */}
        {loading ? (
          <div className="text-center text-gray-400 py-8">Chargement...</div>
        ) : records.length === 0 ? (
          <div className="text-center text-gray-400 py-8">Aucun enregistrement</div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-900">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Employe</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Date</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Entree</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Sortie</th>
                    <th className="text-right p-3 font-medium text-gray-600 dark:text-gray-300">Heures</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-3">{r.user?.name || '...'}</td>
                      <td className="p-3 text-gray-500 dark:text-gray-400">{formatDate(r.clock_in)}</td>
                      <td className="p-3">
                        {new Date(r.clock_in).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3">
                        {r.clock_out
                          ? new Date(r.clock_out).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                          : <span className="text-green-500">En cours</span>}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {r.total_hours != null ? formatHours(r.total_hours) : '--'}
                        {r.break_minutes > 0 && (
                          <span className="text-xs text-gray-400 block">Pause: {r.break_minutes}min</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
