'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { GiftCard, GiftCardTransaction } from '@/types';
import { formatPrice, formatDate, formatDateTime, giftCardStatusLabels } from '@/lib/utils';

export default function GiftCardsPage() {
  const { user } = useAuth();

  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createAmount, setCreateAmount] = useState('');
  const [createExpiry, setCreateExpiry] = useState('');
  const [creating, setCreating] = useState(false);

  // Balance check
  const [checkCode, setCheckCode] = useState('');
  const [checkResult, setCheckResult] = useState<{ code: string; current_balance: number; status: string; expires_at?: string } | null>(null);
  const [checking, setChecking] = useState(false);

  // Detail view
  const [selectedCard, setSelectedCard] = useState<(GiftCard & { transactions?: GiftCardTransaction[] }) | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchCards = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/gift-cards');
      if (!res.ok) throw new Error('Erreur');
      const data = await res.json();
      setCards(data.gift_cards || []);
    } catch {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleCreate = async () => {
    const amount = parseFloat(createAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Montant invalide');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/gift-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_amount: amount,
          expires_at: createExpiry || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur');
        return;
      }
      setCreateAmount('');
      setCreateExpiry('');
      setShowCreateForm(false);
      await fetchCards();
    } catch {
      setError('Erreur de connexion');
    } finally {
      setCreating(false);
    }
  };

  const handleCheckBalance = async () => {
    if (!checkCode.trim()) return;
    setChecking(true);
    setCheckResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/gift-cards/check?code=${encodeURIComponent(checkCode.trim())}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Carte introuvable');
        return;
      }
      setCheckResult(await res.json());
    } catch {
      setError('Erreur de connexion');
    } finally {
      setChecking(false);
    }
  };

  const handleViewDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/gift-cards/${id}`);
      if (res.ok) {
        setSelectedCard(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  };

  const maskCode = (code: string) => {
    if (code.length <= 4) return code;
    return code.slice(0, 4) + '****';
  };

  const statusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'used': return 'bg-gray-100 text-gray-600';
      case 'expired': return 'bg-red-100 text-red-700';
      case 'cancelled': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Cartes cadeau</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-[#2AA8DC] text-white px-3 py-1.5 rounded-lg text-sm font-medium"
        >
          + Creer
        </button>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 font-bold">&times;</button>
          </div>
        )}

        {/* Create form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3 border-2 border-[#2AA8DC]">
            <h3 className="font-semibold text-gray-900">Nouvelle carte cadeau</h3>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Montant (MAD)</label>
              <input
                type="number"
                value={createAmount}
                onChange={(e) => setCreateAmount(e.target.value)}
                placeholder="Ex: 500"
                min="0"
                step="1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Date d&apos;expiration (optionnel)</label>
              <input
                type="date"
                value={createExpiry}
                onChange={(e) => setCreateExpiry(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 bg-[#2AA8DC] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {creating ? 'Creation...' : 'Creer'}
              </button>
            </div>
          </div>
        )}

        {/* Balance check */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Verifier le solde</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={checkCode}
              onChange={(e) => setCheckCode(e.target.value.toUpperCase())}
              placeholder="Code carte"
              maxLength={8}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase tracking-wider"
            />
            <button
              onClick={handleCheckBalance}
              disabled={checking}
              className="bg-[#2AA8DC] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {checking ? '...' : 'Verifier'}
            </button>
          </div>
          {checkResult && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Code: <strong>{checkResult.code}</strong></span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusBadgeColor(checkResult.status)}`}>
                  {giftCardStatusLabels[checkResult.status] || checkResult.status}
                </span>
              </div>
              <p className="text-lg font-bold text-[#2AA8DC] mt-1">
                Solde: {formatPrice(checkResult.current_balance)}
              </p>
              {checkResult.expires_at && (
                <p className="text-xs text-gray-500 mt-1">
                  Expire le {formatDate(checkResult.expires_at)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Detail modal */}
        {selectedCard && (
          <div className="bg-white rounded-xl shadow-sm p-4 border-2 border-[#2AA8DC] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Carte {selectedCard.code}</h3>
              <button onClick={() => setSelectedCard(null)} className="text-gray-400 text-lg">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-500">Montant initial</p>
                <p className="font-medium">{formatPrice(selectedCard.initial_amount)}</p>
              </div>
              <div>
                <p className="text-gray-500">Solde actuel</p>
                <p className="font-bold text-[#2AA8DC]">{formatPrice(selectedCard.current_balance)}</p>
              </div>
            </div>

            {loadingDetail ? (
              <div className="text-center text-sm text-gray-400">Chargement...</div>
            ) : (
              <>
                <h4 className="text-sm font-medium text-gray-700">Transactions</h4>
                {(!selectedCard.transactions || selectedCard.transactions.length === 0) ? (
                  <p className="text-sm text-gray-400 text-center">Aucune transaction</p>
                ) : (
                  <div className="divide-y max-h-60 overflow-y-auto">
                    {selectedCard.transactions.map((tx) => (
                      <div key={tx.id} className="py-2 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {tx.type === 'purchase' ? 'Achat' : tx.type === 'redemption' ? 'Utilisation' : 'Remboursement'}
                          </p>
                          <p className="text-xs text-gray-500">{formatDateTime(tx.created_at)}</p>
                        </div>
                        <span className={`text-sm font-semibold ${tx.type === 'redemption' ? 'text-red-600' : 'text-green-600'}`}>
                          {tx.type === 'redemption' ? '-' : '+'}{formatPrice(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Cards list */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2AA8DC] mx-auto"></div>
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Aucune carte cadeau
          </div>
        ) : (
          <div className="space-y-2">
            {cards.map((card) => (
              <button
                key={card.id}
                onClick={() => handleViewDetail(card.id)}
                className="w-full bg-white rounded-xl shadow-sm p-4 text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-bold text-gray-900 tracking-wider">
                    {maskCode(card.code)}
                  </span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusBadgeColor(card.status)}`}>
                    {giftCardStatusLabels[card.status] || card.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Initial</p>
                    <p className="font-medium">{formatPrice(card.initial_amount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Solde</p>
                    <p className="font-medium text-[#2AA8DC]">{formatPrice(card.current_balance)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Cree le</p>
                    <p className="font-medium">{formatDate(card.created_at)}</p>
                  </div>
                </div>
                {card.customer && (
                  <p className="text-xs text-gray-500 mt-2">Client: {card.customer.name}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
