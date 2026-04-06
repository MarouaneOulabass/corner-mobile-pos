'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Supplier } from '@/types';
import Link from 'next/link';

export default function SuppliersPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', email: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/suppliers?${params}`);
      const data = await res.json();
      setSuppliers(data.suppliers || []);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [user, search]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ name: '', contact_name: '', phone: '', email: '', address: '', notes: '' });
        setShowForm(false);
        fetchSuppliers();
      }
    } finally {
      setSaving(false);
    }
  };

  if (!user || (user.role !== 'superadmin' && user.role !== 'manager')) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        Acces reserve aux managers
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20">
      {/* Header */}
      <div className="bg-[#2AA8DC] text-white p-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Fournisseurs</h1>
            <p className="text-sm opacity-80">{suppliers.length} fournisseur(s)</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-white dark:bg-slate-800 text-[#2AA8DC] px-4 py-2 rounded-xl text-sm font-medium"
          >
            + Ajouter
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Search */}
        <input
          type="text"
          placeholder="Rechercher un fournisseur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-xl p-3 text-sm"
        />

        {/* Add Form */}
        {showForm && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="font-medium text-sm">Nouveau fournisseur</h3>
            <input
              type="text"
              placeholder="Nom *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
            <input
              type="text"
              placeholder="Nom du contact"
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="tel"
                placeholder="Telephone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="border rounded-lg p-2 text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="border rounded-lg p-2 text-sm"
              />
            </div>
            <input
              type="text"
              placeholder="Adresse"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
            <textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={saving || !form.name.trim()}
                className="flex-1 bg-[#2AA8DC] text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border rounded-xl text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Supplier List */}
        {loading ? (
          <div className="text-center text-gray-400 py-8">Chargement...</div>
        ) : suppliers.length === 0 ? (
          <div className="text-center text-gray-400 py-8">Aucun fournisseur</div>
        ) : (
          <div className="space-y-2">
            {suppliers.map((s) => (
              <Link
                key={s.id}
                href={`/suppliers/${s.id}`}
                className="block bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    {s.contact_name && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{s.contact_name}</p>
                    )}
                  </div>
                  <span className="text-gray-400 text-lg">&rsaquo;</span>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {s.phone && <span>{s.phone}</span>}
                  {s.email && <span>{s.email}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
