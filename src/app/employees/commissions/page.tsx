'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Commission, User } from '@/types';
import { formatPrice, formatDate, commissionStatusLabels } from '@/lib/utils';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

export default function CommissionsPage() {
  const { user, activeStoreId } = useAuth();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom] = useState(monthRange().from);
  const [dateTo, setDateTo] = useState(monthRange().to);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchCommissions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterUser) params.set('user_id', filterUser);
      if (filterStatus) params.set('status', filterStatus);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/commissions?${params}`);
      const data = await res.json();
      setCommissions(data.commissions || []);
    } catch {
      setCommissions([]);
    } finally {
      setLoading(false);
    }
  }, [user, filterUser, filterStatus, dateFrom, dateTo]);

  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/auth/me')
      .then(() => fetch('/api/clock/history'))
      .catch(() => {});
    // Load employees for filter
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

  const totalPending = commissions
    .filter((c) => c.status === 'pending')
    .reduce((s, c) => s + c.commission_amount, 0);
  const totalApproved = commissions
    .filter((c) => c.status === 'approved')
    .reduce((s, c) => s + c.commission_amount, 0);
  const totalPaid = commissions
    .filter((c) => c.status === 'paid')
    .reduce((s, c) => s + c.commission_amount, 0);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkAction = async (newStatus: string) => {
    for (const id of Array.from(selected)) {
      await fetch(`/api/commissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    }
    setSelected(new Set());
    fetchCommissions();
  };

  // Per-employee summary
  const employeeSummary = new Map<string, { name: string; pending: number; approved: number; paid: number; total: number }>();
  for (const c of commissions) {
    const name = c.user?.name || 'Inconnu';
    const existing = employeeSummary.get(c.user_id) || { name, pending: 0, approved: 0, paid: 0, total: 0 };
    existing.total += c.commission_amount;
    if (c.status === 'pending') existing.pending += c.commission_amount;
    if (c.status === 'approved') existing.approved += c.commission_amount;
    if (c.status === 'paid') existing.paid += c.commission_amount;
    employeeSummary.set(c.user_id, existing);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20">
      {/* Header */}
      <div className="bg-[#2AA8DC] text-white p-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold">Commissions</h1>
          <p className="text-sm opacity-80">Gestion des commissions employes</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">En attente</p>
            <p className="text-lg font-bold text-yellow-600">{formatPrice(totalPending)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Approuvees</p>
            <p className="text-lg font-bold text-blue-600">{formatPrice(totalApproved)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Payees</p>
            <p className="text-lg font-bold text-green-600">{formatPrice(totalPaid)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="border rounded-lg p-2 text-sm"
            >
              <option value="">Tous les employes</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border rounded-lg p-2 text-sm"
            >
              <option value="">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="approved">Approuvee</option>
              <option value="paid">Payee</option>
              <option value="cancelled">Annulee</option>
            </select>
          </div>
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

        {/* Bulk Actions */}
        {selected.size > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">{selected.size} selectionne(s)</span>
            <div className="flex gap-2">
              <button
                onClick={() => bulkAction('approved')}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg"
              >
                Approuver
              </button>
              <button
                onClick={() => bulkAction('paid')}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg"
              >
                Marquer payee
              </button>
            </div>
          </div>
        )}

        {/* Commission List */}
        {loading ? (
          <div className="text-center text-gray-400 py-8">Chargement...</div>
        ) : commissions.length === 0 ? (
          <div className="text-center text-gray-400 py-8">Aucune commission</div>
        ) : (
          <div className="space-y-2">
            {commissions.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{c.user?.name || 'Inconnu'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[c.status] || ''}`}>
                        {commissionStatusLabels[c.status] || c.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {c.type === 'sale' ? 'Vente' : 'Reparation'} — Base: {formatPrice(c.base_amount)}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm font-bold text-[#2AA8DC]">{formatPrice(c.commission_amount)}</p>
                      <p className="text-xs text-gray-400">{formatDate(c.created_at)}</p>
                    </div>
                    {c.rule && (
                      <p className="text-xs text-gray-400 mt-1">Regle: {c.rule.name}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Per-Employee Summary */}
        {employeeSummary.size > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <h3 className="font-medium text-sm mb-3">Resume par employe</h3>
            <div className="space-y-2">
              {Array.from(employeeSummary.entries()).map(([uid, s]) => (
                <div key={uid} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                  <span className="font-medium">{s.name}</span>
                  <div className="text-end text-xs">
                    <p>Total: <span className="font-bold">{formatPrice(s.total)}</span></p>
                    <p className="text-gray-400">
                      P: {formatPrice(s.pending)} | A: {formatPrice(s.approved)} | $: {formatPrice(s.paid)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
