'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CashSession, CashMovement, CashMovementType } from '@/types';
import { formatPrice, formatDateTime, cashMovementLabels, cashMovementColors } from '@/lib/utils';
import Link from 'next/link';

export default function CashPage() {
  const { user } = useAuth();

  const [session, setSession] = useState<(CashSession & { movements?: CashMovement[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Open session form
  const [openingAmount, setOpeningAmount] = useState('');
  const [opening, setOpening] = useState(false);

  // Movement form
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [movementType, setMovementType] = useState<CashMovementType>('expense');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [submittingMovement, setSubmittingMovement] = useState(false);

  // Close session
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closingAmount, setClosingAmount] = useState('');
  const [closing, setClosing] = useState(false);

  const fetchOpenSession = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/cash/sessions?status=open');
      if (!res.ok) throw new Error('Erreur chargement');
      const data = await res.json();
      if (data.sessions && data.sessions.length > 0) {
        // Fetch full session with movements
        const detailRes = await fetch(`/api/cash/sessions/${data.sessions[0].id}`);
        if (detailRes.ok) {
          setSession(await detailRes.json());
        }
      } else {
        setSession(null);
      }
    } catch {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOpenSession();
  }, [fetchOpenSession]);

  const handleOpenSession = async () => {
    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) {
      setError('Montant invalide');
      return;
    }
    setOpening(true);
    setError(null);
    try {
      const res = await fetch('/api/cash/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opening_amount: amount }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur');
        return;
      }
      setOpeningAmount('');
      await fetchOpenSession();
    } catch {
      setError('Erreur de connexion');
    } finally {
      setOpening(false);
    }
  };

  const handleAddMovement = async () => {
    const amount = parseFloat(movementAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Montant invalide');
      return;
    }
    if (!movementReason.trim()) {
      setError('Raison requise');
      return;
    }
    if (!session) return;

    setSubmittingMovement(true);
    setError(null);
    try {
      const res = await fetch('/api/cash/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          type: movementType,
          amount,
          reason: movementReason.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur');
        return;
      }
      setMovementAmount('');
      setMovementReason('');
      setShowMovementForm(false);
      await fetchOpenSession();
    } catch {
      setError('Erreur de connexion');
    } finally {
      setSubmittingMovement(false);
    }
  };

  const handleCloseSession = async () => {
    const amount = parseFloat(closingAmount);
    if (isNaN(amount) || amount < 0) {
      setError('Montant invalide');
      return;
    }
    if (!session) return;

    setClosing(true);
    setError(null);
    try {
      const res = await fetch(`/api/cash/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closing_amount: amount }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur');
        return;
      }
      setClosingAmount('');
      setShowCloseForm(false);
      await fetchOpenSession();
    } catch {
      setError('Erreur de connexion');
    } finally {
      setClosing(false);
    }
  };

  // Calculate running total
  const calculateCurrentTotal = () => {
    if (!session) return 0;
    let total = session.opening_amount;
    if (session.movements) {
      for (const m of session.movements) {
        switch (m.type) {
          case 'sale':
          case 'deposit':
            total += m.amount;
            break;
          case 'return':
          case 'expense':
          case 'withdrawal':
            total -= m.amount;
            break;
          case 'adjustment':
            total += m.amount;
            break;
        }
      }
    }
    return Math.round(total * 100) / 100;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2AA8DC]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Caisse</h1>
        <Link href="/cash/history" className="text-sm text-[#2AA8DC] font-medium">
          Historique
        </Link>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {!session ? (
          /* No open session — show open form */
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-2">&#x1f4b0;</div>
              <h2 className="text-lg font-semibold text-gray-900">Pas de caisse ouverte</h2>
              <p className="text-sm text-gray-500 mt-1">Ouvrez la caisse pour commencer la journee</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant d&apos;ouverture (MAD)
              </label>
              <input
                type="number"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg text-center focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent"
              />
            </div>

            <button
              onClick={handleOpenSession}
              disabled={opening}
              className="w-full bg-[#2AA8DC] text-white py-4 rounded-xl font-semibold text-lg disabled:opacity-50"
            >
              {opening ? 'Ouverture...' : 'Ouvrir la caisse'}
            </button>
          </div>
        ) : (
          /* Open session — show session info, movements, close */
          <>
            {/* Session info */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Session ouverte</span>
                <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full">
                  Active
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Ouvert par</p>
                  <p className="font-medium">{session.opener?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Ouverture</p>
                  <p className="font-medium">{formatPrice(session.opening_amount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Heure</p>
                  <p className="font-medium">{formatDateTime(session.opened_at)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total actuel</p>
                  <p className="font-semibold text-[#2AA8DC]">{formatPrice(calculateCurrentTotal())}</p>
                </div>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { setMovementType('expense'); setShowMovementForm(true); }}
                className="bg-white rounded-xl shadow-sm p-3 text-center"
              >
                <div className="text-red-500 text-xl mb-1">-</div>
                <div className="text-xs font-medium text-gray-700">Depense</div>
              </button>
              <button
                onClick={() => { setMovementType('deposit'); setShowMovementForm(true); }}
                className="bg-white rounded-xl shadow-sm p-3 text-center"
              >
                <div className="text-blue-500 text-xl mb-1">+</div>
                <div className="text-xs font-medium text-gray-700">Depot</div>
              </button>
              <button
                onClick={() => { setMovementType('withdrawal'); setShowMovementForm(true); }}
                className="bg-white rounded-xl shadow-sm p-3 text-center"
              >
                <div className="text-orange-500 text-xl mb-1">-</div>
                <div className="text-xs font-medium text-gray-700">Retrait</div>
              </button>
            </div>

            {/* Movement form modal */}
            {showMovementForm && (
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-3 border-2 border-[#2AA8DC]">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">
                    {cashMovementLabels[movementType] || movementType}
                  </h3>
                  <button onClick={() => setShowMovementForm(false)} className="text-gray-400 text-lg">
                    &times;
                  </button>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Type</label>
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as CashMovementType)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="expense">Depense</option>
                    <option value="deposit">Depot</option>
                    <option value="withdrawal">Retrait</option>
                    <option value="adjustment">Ajustement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Montant (MAD)</label>
                  <input
                    type="number"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Raison</label>
                  <input
                    type="text"
                    value={movementReason}
                    onChange={(e) => setMovementReason(e.target.value)}
                    placeholder="Ex: Achat fournitures"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <button
                  onClick={handleAddMovement}
                  disabled={submittingMovement}
                  className="w-full bg-[#2AA8DC] text-white py-3 rounded-lg font-medium disabled:opacity-50"
                >
                  {submittingMovement ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            )}

            {/* Recent movements */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold text-gray-900">Mouvements recents</h3>
              </div>
              {(!session.movements || session.movements.length === 0) ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  Aucun mouvement
                </div>
              ) : (
                <div className="divide-y">
                  {session.movements.map((m) => (
                    <div key={m.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {cashMovementLabels[m.type] || m.type}
                        </p>
                        <p className="text-xs text-gray-500">{m.reason || '-'}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(m.created_at)}</p>
                      </div>
                      <span className={`font-semibold text-sm ${cashMovementColors[m.type] || 'text-gray-600'}`}>
                        {m.type === 'expense' || m.type === 'withdrawal' || m.type === 'return' ? '-' : '+'}
                        {formatPrice(m.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Close session */}
            {!showCloseForm ? (
              <button
                onClick={() => setShowCloseForm(true)}
                className="w-full bg-red-500 text-white py-4 rounded-xl font-semibold text-lg"
              >
                Fermer la caisse
              </button>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-3 border-2 border-red-300">
                <h3 className="font-semibold text-gray-900">Fermeture de caisse</h3>
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="text-gray-500">Montant attendu</p>
                  <p className="font-bold text-lg text-gray-900">{formatPrice(calculateCurrentTotal())}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Montant reel compte (MAD)</label>
                  <input
                    type="number"
                    value={closingAmount}
                    onChange={(e) => setClosingAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-lg text-center"
                  />
                </div>
                {closingAmount && (
                  <div className="text-sm text-center">
                    <span className="text-gray-500">Difference: </span>
                    <span className={
                      parseFloat(closingAmount) - calculateCurrentTotal() >= 0
                        ? 'text-green-600 font-semibold'
                        : 'text-red-600 font-semibold'
                    }>
                      {formatPrice(parseFloat(closingAmount) - calculateCurrentTotal())}
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCloseForm(false)}
                    className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleCloseSession}
                    disabled={closing}
                    className="flex-1 bg-red-500 text-white py-3 rounded-lg font-medium disabled:opacity-50"
                  >
                    {closing ? 'Fermeture...' : 'Confirmer'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
