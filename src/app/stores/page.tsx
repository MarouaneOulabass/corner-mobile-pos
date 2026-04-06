'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Store } from '@/types';

interface StoreWithCounts extends Store {
  user_count?: number;
  product_count?: number;
}

export default function StoresPage() {
  const { user } = useAuth();
  const [stores, setStores] = useState<StoreWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New store form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formLocation, setFormLocation] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stores');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Fetch counts for each store
      const storesWithCounts: StoreWithCounts[] = await Promise.all(
        (data.stores || []).map(async (store: Store) => {
          const [usersRes, productsRes] = await Promise.all([
            fetch(`/api/users?store_id=${store.id}`).catch(() => null),
            fetch(`/api/products?store_id=${store.id}&limit=1`).catch(() => null),
          ]);
          const usersData = usersRes?.ok ? await usersRes.json() : null;
          const productsData = productsRes?.ok ? await productsRes.json() : null;
          return {
            ...store,
            user_count: usersData?.users?.length || 0,
            product_count: productsData?.total || 0,
          };
        })
      );

      setStores(storesWithCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  // Access control
  if (user && user.role !== 'superadmin') {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-red-600 dark:text-red-400">Accès refusé</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Seul un super administrateur peut gérer les magasins.
        </p>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!formName.trim() || !formLocation.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim(), location: formLocation.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFormName('');
      setFormLocation('');
      setShowForm(false);
      fetchStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de création');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim() || !editLocation.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), location: editLocation.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingId(null);
      fetchStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeletingId(null);
      fetchStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (store: StoreWithCounts) => {
    setEditingId(store.id);
    setEditName(store.name);
    setEditLocation(store.location);
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Magasins</h1>
        <button
          onClick={() => { setShowForm(!showForm); setError(null); }}
          className="px-4 py-2 rounded-xl text-white text-sm font-medium"
          style={{ backgroundColor: '#2AA8DC' }}
        >
          {showForm ? 'Annuler' : 'Ajouter un magasin'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="mb-6 p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Nouveau magasin</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Corner Mobile M3"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Localisation</label>
              <input
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="Ex: Centre Commercial XYZ, Rabat"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={saving || !formName.trim() || !formLocation.trim()}
              className="w-full py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: '#5BBF3E' }}
            >
              {saving ? 'Enregistrement...' : 'Créer le magasin'}
            </button>
          </div>
        </div>
      )}

      {/* Store list */}
      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Chargement...</div>
      ) : stores.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Aucun magasin</div>
      ) : (
        <div className="space-y-3">
          {stores.map((store) => (
            <div
              key={store.id}
              className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
            >
              {editingId === store.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                  />
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(store.id)}
                      disabled={saving}
                      className="flex-1 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                      style={{ backgroundColor: '#5BBF3E' }}
                    >
                      {saving ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 py-2 rounded-lg bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 text-sm font-medium"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : deletingId === store.id ? (
                <div className="space-y-3">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                    Supprimer le magasin &quot;{store.name}&quot; ?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(store.id)}
                      disabled={saving}
                      className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {saving ? 'Suppression...' : 'Confirmer'}
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="flex-1 py-2 rounded-lg bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 text-sm font-medium"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{store.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{store.location}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(store)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => setDeletingId(store.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>{store.user_count || 0} utilisateur{(store.user_count || 0) !== 1 ? 's' : ''}</span>
                    <span>{store.product_count || 0} produit{(store.product_count || 0) !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
