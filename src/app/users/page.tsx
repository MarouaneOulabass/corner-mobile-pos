'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Store, UserRole } from '@/types';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  store_id: string;
  created_at: string;
  store: { id: string; name: string; location: string } | null;
}

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  manager: 'Manager',
  seller: 'Vendeur',
};

const ROLE_COLORS: Record<UserRole, string> = {
  superadmin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  seller: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStore, setFilterStore] = useState('');

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('seller');
  const [formStoreId, setFormStoreId] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('seller');
  const [editStoreId, setEditStoreId] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isSuperadmin = currentUser?.role === 'superadmin';

  const fetchStores = useCallback(async () => {
    try {
      const res = await fetch('/api/stores');
      const data = await res.json();
      if (res.ok) {
        setStores(data.stores || []);
        // Default store for form
        if (data.stores?.length > 0 && !formStoreId) {
          setFormStoreId(data.stores[0].id);
        }
      }
    } catch {
      // Stores fetch is best-effort
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
    fetchUsers();
  }, [fetchStores, fetchUsers]);

  // Access control
  if (currentUser && currentUser.role === 'seller') {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-red-600 dark:text-red-400">Accès refusé</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Vous n&apos;avez pas les droits pour gérer les utilisateurs.
        </p>
      </div>
    );
  }

  const filteredUsers = filterStore
    ? users.filter((u) => u.store_id === filterStore)
    : users;

  const handleCreate = async () => {
    if (!formName.trim() || !formEmail.trim() || !formPassword || !formStoreId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          password: formPassword,
          role: formRole,
          store_id: formStoreId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFormName('');
      setFormEmail('');
      setFormPassword('');
      setFormRole('seller');
      setShowForm(false);
      setShowPassword(false);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de création');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim() || !editEmail.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, string> = {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        role: editRole,
        store_id: editStoreId,
      };
      if (editPassword) payload.password = editPassword;

      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingId(null);
      setEditPassword('');
      setShowEditPassword(false);
      fetchUsers();
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
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeletingId(null);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (u: UserRow) => {
    setEditingId(u.id);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditStoreId(u.store_id);
    setEditPassword('');
    setShowEditPassword(false);
  };

  const availableRoles: UserRole[] = isSuperadmin
    ? ['superadmin', 'manager', 'seller']
    : ['seller'];

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Utilisateurs</h1>
        <button
          onClick={() => { setShowForm(!showForm); setError(null); }}
          className="px-4 py-2 rounded-xl text-white text-sm font-medium"
          style={{ backgroundColor: '#2AA8DC' }}
        >
          {showForm ? 'Annuler' : 'Ajouter un utilisateur'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Store filter (superadmin only) */}
      {isSuperadmin && stores.length > 1 && (
        <div className="mb-4">
          <select
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="">Tous les magasins</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="mb-6 p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Nouvel utilisateur</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nom complet"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@exemple.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Mot de passe"
                  className="w-full px-3 py-2 pr-16 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400 px-2 py-1"
                >
                  {showPassword ? 'Masquer' : 'Afficher'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rôle</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Magasin</label>
              <select
                value={formStoreId}
                onChange={(e) => setFormStoreId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCreate}
              disabled={saving || !formName.trim() || !formEmail.trim() || !formPassword}
              className="w-full py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: '#5BBF3E' }}
            >
              {saving ? 'Enregistrement...' : 'Créer l\'utilisateur'}
            </button>
          </div>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Chargement...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Aucun utilisateur</div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
            >
              {editingId === u.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nom"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                  />
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                  />
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    disabled={u.id === currentUser?.id}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
                  >
                    {availableRoles.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  {isSuperadmin && (
                    <select
                      value={editStoreId}
                      onChange={(e) => setEditStoreId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                    >
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nouveau mot de passe (optionnel)
                    </label>
                    <div className="relative">
                      <input
                        type={showEditPassword ? 'text' : 'password'}
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Laisser vide pour ne pas changer"
                        className="w-full px-3 py-2 pr-16 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400 px-2 py-1"
                      >
                        {showEditPassword ? 'Masquer' : 'Afficher'}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(u.id)}
                      disabled={saving}
                      className="flex-1 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                      style={{ backgroundColor: '#5BBF3E' }}
                    >
                      {saving ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditPassword(''); setShowEditPassword(false); }}
                      className="flex-1 py-2 rounded-lg bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 text-sm font-medium"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : deletingId === u.id ? (
                <div className="space-y-3">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                    Supprimer l&apos;utilisateur &quot;{u.name}&quot; ?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(u.id)}
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
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{u.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{u.email}</p>
                      {u.store && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{u.store.name}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(u)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                      >
                        Modifier
                      </button>
                      {isSuperadmin && u.id !== currentUser?.id && (
                        <button
                          onClick={() => setDeletingId(u.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
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
