'use client';

import { useState } from 'react';
import DashboardShell from '@/components/layouts/DashboardShell';
import { formatPrice, formatDateTime, loyaltyTierLabels, loyaltyTierColors } from '@/lib/utils';
import { LoyaltyTier, LoyaltyTransaction } from '@/types';

interface LoyaltyCustomer {
  id: string;
  name: string;
  phone: string;
  tier: LoyaltyTier;
  points: number;
  total_earned: number;
}

const tierOrder: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum'];

export default function LoyaltyPage() {
  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState<LoyaltyCustomer | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Adjustment form
  const [adjType, setAdjType] = useState<'bonus' | 'adjustment'>('bonus');
  const [adjPoints, setAdjPoints] = useState('');
  const [adjDesc, setAdjDesc] = useState('');
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjSuccess, setAdjSuccess] = useState('');

  // Tier thresholds (fetched from settings)
  const [thresholds, setThresholds] = useState({
    bronze: 0,
    silver: 500,
    gold: 2000,
    platinum: 5000,
  });

  const searchCustomer = async () => {
    setError('');
    setCustomer(null);
    setTransactions([]);
    setAdjSuccess('');

    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.length < 8) {
      setError('Veuillez entrer un numéro de téléphone valide');
      return;
    }

    setLoading(true);
    try {
      // Search customer by phone
      const custRes = await fetch(`/api/customers?search=${encodeURIComponent(cleaned)}`);
      const custData = await custRes.json();

      const customers = custData.customers || [];
      const found = customers.find(
        (c: { phone: string }) => c.phone.replace(/[^0-9]/g, '').includes(cleaned.replace(/[^0-9]/g, ''))
      );

      if (!found) {
        setError('Aucun client trouvé avec ce numéro');
        setLoading(false);
        return;
      }

      // Fetch loyalty info
      const loyRes = await fetch(`/api/loyalty?customer_id=${found.id}`);
      const loyData = await loyRes.json();

      if (!loyRes.ok) {
        setError(loyData.error || 'Erreur lors du chargement');
        setLoading(false);
        return;
      }

      setCustomer(loyData.customer);
      setTransactions(loyData.transactions || []);

      // Fetch settings for thresholds
      const setRes = await fetch('/api/loyalty/settings');
      const setData = await setRes.json();
      if (setData.settings) {
        setThresholds({
          bronze: setData.settings.bronze_threshold || 0,
          silver: setData.settings.silver_threshold || 500,
          gold: setData.settings.gold_threshold || 2000,
          platinum: setData.settings.platinum_threshold || 5000,
        });
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const pts = parseInt(adjPoints, 10);
    if (isNaN(pts) || pts === 0) {
      setError('Points invalides');
      return;
    }

    setAdjLoading(true);
    setError('');
    setAdjSuccess('');

    try {
      const res = await fetch('/api/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer.id,
          type: adjType,
          points: pts,
          description: adjDesc || `${adjType === 'bonus' ? 'Bonus' : 'Ajustement'} manuel`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur');
      } else {
        setAdjSuccess(`Points mis à jour. Nouveau solde : ${data.new_balance} pts (${loyaltyTierLabels[data.new_tier]})`);
        setAdjPoints('');
        setAdjDesc('');
        // Refresh data
        setCustomer(prev => prev ? { ...prev, points: data.new_balance, tier: data.new_tier } : null);
        // Refresh transactions
        const loyRes = await fetch(`/api/loyalty?customer_id=${customer.id}`);
        const loyData = await loyRes.json();
        setTransactions(loyData.transactions || []);
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setAdjLoading(false);
    }
  };

  // Calculate progress to next tier
  const getNextTier = (currentTier: LoyaltyTier): { next: LoyaltyTier | null; threshold: number } => {
    const idx = tierOrder.indexOf(currentTier);
    if (idx >= tierOrder.length - 1) return { next: null, threshold: 0 };
    const nextTier = tierOrder[idx + 1];
    return { next: nextTier, threshold: thresholds[nextTier] };
  };

  const tierProgress = customer
    ? (() => {
        const { next, threshold } = getNextTier(customer.tier);
        if (!next) return { percent: 100, label: 'Niveau maximum atteint' };
        const currentThreshold = thresholds[customer.tier];
        const range = threshold - currentThreshold;
        const progress = customer.total_earned - currentThreshold;
        const percent = Math.min(100, Math.max(0, (progress / range) * 100));
        return {
          percent,
          label: `${customer.total_earned} / ${threshold} pts pour ${loyaltyTierLabels[next]}`,
        };
      })()
    : null;

  return (
    <DashboardShell>
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-4">Programme de Fidelite</h1>

        {/* Search */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rechercher un client
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Numero de telephone"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]"
              onKeyDown={e => e.key === 'Enter' && searchCustomer()}
            />
            <button
              onClick={searchCustomer}
              disabled={loading}
              className="bg-[#2AA8DC] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {loading ? '...' : 'Chercher'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">{error}</div>
        )}

        {adjSuccess && (
          <div className="bg-green-50 text-green-600 p-3 rounded-xl text-sm mb-4">{adjSuccess}</div>
        )}

        {customer && (
          <>
            {/* Customer Card */}
            <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold text-lg">{customer.name}</h2>
                  <p className="text-sm text-gray-500">{customer.phone}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${loyaltyTierColors[customer.tier]}`}
                >
                  {loyaltyTierLabels[customer.tier]}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <div className="text-center">
                  <p className="text-3xl font-bold text-[#2AA8DC]">{customer.points}</p>
                  <p className="text-sm text-gray-500">Points disponibles</p>
                </div>
              </div>

              {/* Tier Progress */}
              {tierProgress && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{loyaltyTierLabels[customer.tier]}</span>
                    <span>{tierProgress.label}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#2AA8DC] h-2 rounded-full transition-all"
                      style={{ width: `${tierProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Manual Adjustment */}
            <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
              <h3 className="font-semibold mb-3">Ajustement manuel</h3>
              <form onSubmit={handleAdjust} className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjType('bonus')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                      adjType === 'bonus'
                        ? 'bg-[#2AA8DC] text-white border-[#2AA8DC]'
                        : 'bg-white text-gray-600 border-gray-300'
                    }`}
                  >
                    Bonus
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType('adjustment')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                      adjType === 'adjustment'
                        ? 'bg-[#2AA8DC] text-white border-[#2AA8DC]'
                        : 'bg-white text-gray-600 border-gray-300'
                    }`}
                  >
                    Ajustement
                  </button>
                </div>

                <input
                  type="number"
                  value={adjPoints}
                  onChange={e => setAdjPoints(e.target.value)}
                  placeholder={adjType === 'adjustment' ? 'Points (negatif pour deduire)' : 'Points a ajouter'}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]"
                  required
                />

                <input
                  type="text"
                  value={adjDesc}
                  onChange={e => setAdjDesc(e.target.value)}
                  placeholder="Raison (ex: Bonus anniversaire)"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]"
                />

                <button
                  type="submit"
                  disabled={adjLoading}
                  className="w-full bg-[#5BBF3E] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {adjLoading ? 'En cours...' : 'Appliquer'}
                </button>
              </form>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold mb-3">Transactions recentes</h3>
              {transactions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Aucune transaction</p>
              ) : (
                <div className="space-y-2">
                  {transactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">
                          {tx.type === 'earn' && 'Gains'}
                          {tx.type === 'redeem' && 'Utilisation'}
                          {tx.type === 'bonus' && 'Bonus'}
                          {tx.type === 'adjustment' && 'Ajustement'}
                          {tx.type === 'expire' && 'Expiration'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {tx.description || '-'}
                        </p>
                        <p className="text-xs text-gray-300">{formatDateTime(tx.created_at)}</p>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          tx.points > 0 ? 'text-green-600' : 'text-red-500'
                        }`}
                      >
                        {tx.points > 0 ? '+' : ''}{tx.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
