'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ClockRecord, User } from '@/types';
import { formatDateTime, formatHours } from '@/lib/utils';

export default function ClockPage() {
  const { user } = useAuth();
  const [clockedIn, setClockedIn] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ClockRecord | null>(null);
  const [todayRecords, setTodayRecords] = useState<ClockRecord[]>([]);
  const [allStatus, setAllStatus] = useState<{ user: User; record: ClockRecord | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [elapsed, setElapsed] = useState('');
  const [breakMinutes, setBreakMinutes] = useState(0);

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/clock');
      const data = await res.json();
      setClockedIn(data.clocked_in);
      setCurrentRecord(data.current_record);
    } catch {
      // ignore
    }
  }, [user]);

  const fetchToday = useCallback(async () => {
    if (!user) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const params = new URLSearchParams({ date_from: today, date_to: today });
      const res = await fetch(`/api/clock/history?${params}`);
      const data = await res.json();
      setTodayRecords(data.records || []);
    } catch {
      setTodayRecords([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // For managers: fetch all employees clock status
  const fetchAllStatus = useCallback(async () => {
    if (!user || user.role === 'seller') return;
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: users } = await supabase
        .from('users')
        .select('id, name, role, store_id')
        .eq('store_id', user.store_id);

      if (!users) return;

      const statuses: { user: User; record: ClockRecord | null }[] = [];
      const { data: records } = await supabase
        .from('clock_records')
        .select('*')
        .eq('store_id', user.store_id)
        .is('clock_out', null);

      const recordMap = new Map((records || []).map((r) => [r.user_id, r]));

      for (const u of users) {
        statuses.push({
          user: u as User,
          record: (recordMap.get(u.id) as ClockRecord) || null,
        });
      }
      setAllStatus(statuses);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    fetchStatus();
    fetchToday();
    fetchAllStatus();
  }, [fetchStatus, fetchToday, fetchAllStatus]);

  // Elapsed timer
  useEffect(() => {
    if (!clockedIn || !currentRecord) {
      setElapsed('');
      return;
    }
    const update = () => {
      const diff = Date.now() - new Date(currentRecord.clock_in).getTime();
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setElapsed(`${hours}h${mins.toString().padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [clockedIn, currentRecord]);

  const handleClockIn = async () => {
    setActing(true);
    try {
      await fetch('/api/clock', { method: 'POST' });
      await fetchStatus();
      await fetchToday();
      await fetchAllStatus();
    } finally {
      setActing(false);
    }
  };

  const handleClockOut = async () => {
    setActing(true);
    try {
      await fetch('/api/clock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ break_minutes: breakMinutes }),
      });
      setClockedIn(false);
      setCurrentRecord(null);
      setBreakMinutes(0);
      await fetchToday();
      await fetchAllStatus();
    } finally {
      setActing(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-[#2AA8DC] text-white p-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold">Pointage</h1>
          <p className="text-sm opacity-80">Horloge de presence</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Clock In/Out Button */}
        <div className="bg-white rounded-xl p-6 shadow-sm text-center">
          {clockedIn ? (
            <>
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">&#128994;</span>
              </div>
              <p className="text-sm text-gray-500 mb-1">Pointe depuis</p>
              <p className="text-3xl font-bold text-green-600 mb-4">{elapsed || '...'}</p>

              <div className="mb-4">
                <label className="text-sm text-gray-500">Pause (minutes)</label>
                <input
                  type="number"
                  min="0"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
                  className="border rounded-lg p-2 w-24 text-center ml-2"
                />
              </div>

              <button
                onClick={handleClockOut}
                disabled={acting}
                className="w-full py-4 bg-red-500 text-white text-lg font-bold rounded-xl disabled:opacity-50"
              >
                {acting ? 'Traitement...' : 'Depointer'}
              </button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">&#9898;</span>
              </div>
              <p className="text-lg text-gray-500 mb-4">Non pointe</p>
              <button
                onClick={handleClockIn}
                disabled={acting}
                className="w-full py-4 bg-[#5BBF3E] text-white text-lg font-bold rounded-xl disabled:opacity-50"
              >
                {acting ? 'Traitement...' : 'Pointer'}
              </button>
            </>
          )}
        </div>

        {/* Today's Records */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-medium text-sm mb-3">Aujourd&apos;hui</h3>
          {loading ? (
            <p className="text-gray-400 text-sm">Chargement...</p>
          ) : todayRecords.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucun pointage aujourd&apos;hui</p>
          ) : (
            <div className="space-y-2">
              {todayRecords.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                  <div>
                    <p className="font-medium">
                      {new Date(r.clock_in).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      {r.clock_out
                        ? ` - ${new Date(r.clock_out).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                        : ' - En cours'}
                    </p>
                    {r.break_minutes > 0 && (
                      <p className="text-xs text-gray-400">Pause: {r.break_minutes}min</p>
                    )}
                  </div>
                  <p className="font-bold text-[#2AA8DC]">
                    {r.total_hours != null ? formatHours(r.total_hours) : '--'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manager: All Employees Status */}
        {user.role !== 'seller' && allStatus.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-medium text-sm mb-3">Statut equipe</h3>
            <div className="space-y-2">
              {allStatus.map((s) => (
                <div key={s.user.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${s.record ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="font-medium">{s.user.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {s.record
                      ? `Depuis ${new Date(s.record.clock_in).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Non pointe'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
