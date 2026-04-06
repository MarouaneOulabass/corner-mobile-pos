'use client';

import { useState } from 'react';
import { formatPrice } from '@/lib/utils';

interface GiftCardInputProps {
  onRedeem: (code: string, balance: number) => void;
}

export default function GiftCardInput({ onRedeem }: GiftCardInputProps) {
  const [code, setCode] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const handleCheck = async () => {
    if (!code.trim()) return;
    setChecking(true);
    setError(null);
    setBalance(null);
    setChecked(false);
    try {
      const res = await fetch(`/api/gift-cards/check?code=${encodeURIComponent(code.trim())}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Carte introuvable');
        return;
      }
      const data = await res.json();
      if (data.status !== 'active') {
        setError(`Carte non utilisable (${data.status})`);
        return;
      }
      setBalance(data.current_balance);
      setStatus(data.status);
      setChecked(true);
    } catch {
      setError('Erreur de connexion');
    } finally {
      setChecking(false);
    }
  };

  const handleApply = () => {
    if (balance != null && balance > 0 && code.trim()) {
      onRedeem(code.trim().toUpperCase(), balance);
      setCode('');
      setBalance(null);
      setStatus(null);
      setChecked(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setChecked(false);
            setBalance(null);
            setError(null);
          }}
          placeholder="Code carte cadeau"
          maxLength={8}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase tracking-wider font-mono"
        />
        <button
          onClick={handleCheck}
          disabled={checking || !code.trim()}
          className="bg-[#2AA8DC] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {checking ? '...' : 'Verifier'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {checked && balance != null && status === 'active' && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <div>
            <p className="text-sm text-green-700 font-medium">Solde: {formatPrice(balance)}</p>
          </div>
          <button
            onClick={handleApply}
            className="bg-[#5BBF3E] text-white px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            Appliquer
          </button>
        </div>
      )}
    </div>
  );
}
