'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/layouts/DashboardShell';

interface SettingsForm {
  points_per_mad: number;
  redemption_rate: number;
  bronze_threshold: number;
  silver_threshold: number;
  gold_threshold: number;
  platinum_threshold: number;
  enabled: boolean;
}

const defaultSettings: SettingsForm = {
  points_per_mad: 1,
  redemption_rate: 0.1,
  bronze_threshold: 0,
  silver_threshold: 500,
  gold_threshold: 2000,
  platinum_threshold: 5000,
  enabled: false,
};

export default function LoyaltySettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<SettingsForm>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user && !['superadmin', 'manager'].includes(user.role)) {
      router.push('/');
      return;
    }
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/loyalty/settings');
      const data = await res.json();
      if (data.settings) {
        setForm({
          points_per_mad: data.settings.points_per_mad ?? defaultSettings.points_per_mad,
          redemption_rate: data.settings.redemption_rate ?? defaultSettings.redemption_rate,
          bronze_threshold: data.settings.bronze_threshold ?? defaultSettings.bronze_threshold,
          silver_threshold: data.settings.silver_threshold ?? defaultSettings.silver_threshold,
          gold_threshold: data.settings.gold_threshold ?? defaultSettings.gold_threshold,
          platinum_threshold: data.settings.platinum_threshold ?? defaultSettings.platinum_threshold,
          enabled: data.settings.enabled ?? defaultSettings.enabled,
        });
      }
    } catch {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/loyalty/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la sauvegarde');
      } else {
        setSuccess('Parametres enregistres avec succes');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof SettingsForm, value: number | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="p-4 max-w-lg mx-auto flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-4">Parametres Fidelite</h1>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Comment fonctionne le programme ?</h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>Les clients gagnent des points a chaque achat selon le taux configure</li>
            <li>Les points peuvent etre echanges contre des remises au POS</li>
            <li>Les niveaux (Bronze, Argent, Or, Platine) sont bases sur le total de points gagnes</li>
            <li>Valeur de 1 point = taux de conversion configure en MAD</li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded-xl text-sm mb-4">{success}</div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Enable Toggle */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Programme actif</p>
                <p className="text-xs text-gray-400">Activer/desactiver le programme de fidelite</p>
              </div>
              <button
                type="button"
                onClick={() => updateField('enabled', !form.enabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  form.enabled ? 'bg-[#5BBF3E]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    form.enabled ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Rates */}
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <h3 className="font-semibold">Taux de conversion</h3>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Points gagnes par MAD depense
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.points_per_mad}
                onChange={e => updateField('points_per_mad', parseFloat(e.target.value) || 0)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]"
              />
              <p className="text-xs text-gray-400 mt-1">
                Ex: 1 = le client gagne 1 point pour chaque 1 MAD depense
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Valeur de 1 point (en MAD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.redemption_rate}
                onChange={e => updateField('redemption_rate', parseFloat(e.target.value) || 0)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]"
              />
              <p className="text-xs text-gray-400 mt-1">
                Ex: 0.10 = 100 points = 10 MAD de remise
              </p>
            </div>
          </div>

          {/* Tier Thresholds */}
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <h3 className="font-semibold">Seuils des niveaux</h3>
            <p className="text-xs text-gray-400">Total de points gagnes necessaires pour atteindre chaque niveau</p>

            {[
              { key: 'bronze_threshold' as const, label: 'Bronze', color: 'text-amber-700' },
              { key: 'silver_threshold' as const, label: 'Argent', color: 'text-gray-600' },
              { key: 'gold_threshold' as const, label: 'Or', color: 'text-yellow-700' },
              { key: 'platinum_threshold' as const, label: 'Platine', color: 'text-purple-700' },
            ].map(tier => (
              <div key={tier.key}>
                <label className={`block text-sm font-medium ${tier.color} mb-1`}>
                  {tier.label}
                </label>
                <input
                  type="number"
                  min="0"
                  value={form[tier.key]}
                  onChange={e => updateField(tier.key, parseInt(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]"
                />
              </div>
            ))}
          </div>

          {/* Save */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#2AA8DC] text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer les parametres'}
          </button>
        </form>
      </div>
    </DashboardShell>
  );
}
