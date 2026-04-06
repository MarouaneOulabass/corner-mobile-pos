'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PortalLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.length < 8) {
      setError('Veuillez entrer un numero de telephone valide');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur de connexion');
        return;
      }

      // Store token and customer info in localStorage
      localStorage.setItem('portal_token', data.token);
      localStorage.setItem('portal_customer', JSON.stringify(data.customer));

      router.push('/portal/dashboard');
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2AA8DC] to-[#1a7fa8] flex flex-col items-center justify-center px-4">
      {/* Logo / Branding */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-3xl font-bold text-[#2AA8DC]">CM</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Corner Mobile</h1>
        <p className="text-white/80 text-sm mt-1">Espace Client</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Bienvenue</h2>
        <p className="text-sm text-gray-500 mb-6">
          Entrez votre numero de telephone pour acceder a votre espace client.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numero de telephone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="06 XX XX XX XX"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || !phone.trim()}
            className="w-full bg-[#2AA8DC] text-white py-3 rounded-xl font-medium text-base disabled:opacity-50 transition-opacity"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Connexion...
              </span>
            ) : (
              'Acceder a mon espace'
            )}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          Vous devez avoir un compte client chez Corner Mobile pour acceder a cet espace.
        </p>
      </div>

      {/* Footer */}
      <p className="text-white/60 text-xs mt-8">
        Corner Mobile - Rabat, Maroc
      </p>
    </div>
  );
}
