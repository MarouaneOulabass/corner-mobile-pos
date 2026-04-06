'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Supplier } from '@/types';
import { formatPrice } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface POItemRow {
  description: string;
  product_type: string;
  brand: string;
  model: string;
  quantity_ordered: number;
  unit_cost: number;
}

const emptyItem: POItemRow = {
  description: '',
  product_type: 'accessory',
  brand: '',
  model: '',
  quantity_ordered: 1,
  unit_cost: 0,
};

export default function NewPurchaseOrderPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<POItemRow[]>([{ ...emptyItem }]);
  const [notes, setNotes] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/suppliers')
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers || []))
      .catch(() => {});
  }, []);

  const updateItem = (index: number, field: keyof POItemRow, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...emptyItem }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = items.reduce((s, item) => s + item.quantity_ordered * item.unit_cost, 0);

  const handleSubmit = async (asDraft: boolean) => {
    setError('');
    if (!supplierId) {
      setError('Selectionnez un fournisseur');
      return;
    }
    const validItems = items.filter((i) => i.description.trim());
    if (validItems.length === 0) {
      setError('Ajoutez au moins un article');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          items: validItems,
          notes: notes || undefined,
          expected_date: expectedDate || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur');
        return;
      }

      const po = await res.json();

      // If not draft, send it
      if (!asDraft && po.id) {
        await fetch(`/api/purchase-orders/${po.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'sent' }),
        });
      }

      router.push('/purchase-orders');
    } catch {
      setError('Erreur de connexion');
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
        <div className="max-w-lg mx-auto">
          <button onClick={() => router.back()} className="text-sm opacity-80">&larr; Retour</button>
          <h1 className="text-xl font-bold">Nouveau bon de commande</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>
        )}

        {/* Supplier Selection */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Fournisseur *</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full border rounded-lg p-2 text-sm"
          >
            <option value="">-- Selectionnez --</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Date prevue</label>
          <input
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            className="w-full border rounded-lg p-2 text-sm"
          />
        </div>

        {/* Items */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-4">
          <h3 className="font-medium text-sm">Articles</h3>
          {items.map((item, idx) => (
            <div key={idx} className="border rounded-lg p-3 space-y-2 relative">
              {items.length > 1 && (
                <button
                  onClick={() => removeItem(idx)}
                  className="absolute top-2 right-2 text-red-400 text-xs"
                >
                  Supprimer
                </button>
              )}
              <input
                type="text"
                placeholder="Description *"
                value={item.description}
                onChange={(e) => updateItem(idx, 'description', e.target.value)}
                className="w-full border rounded-lg p-2 text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={item.product_type}
                  onChange={(e) => updateItem(idx, 'product_type', e.target.value)}
                  className="border rounded-lg p-2 text-sm"
                >
                  <option value="phone">Telephone</option>
                  <option value="accessory">Accessoire</option>
                  <option value="part">Piece</option>
                </select>
                <input
                  type="text"
                  placeholder="Marque"
                  value={item.brand}
                  onChange={(e) => updateItem(idx, 'brand', e.target.value)}
                  className="border rounded-lg p-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Modele"
                  value={item.model}
                  onChange={(e) => updateItem(idx, 'model', e.target.value)}
                  className="border rounded-lg p-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Quantite</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity_ordered}
                    onChange={(e) => updateItem(idx, 'quantity_ordered', parseInt(e.target.value) || 1)}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Cout unitaire (MAD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_cost}
                    onChange={(e) => updateItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-right text-gray-500 dark:text-gray-400">
                Sous-total: {formatPrice(item.quantity_ordered * item.unit_cost)}
              </p>
            </div>
          ))}
          <button
            onClick={addItem}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 dark:text-gray-400"
          >
            + Ajouter un article
          </button>
        </div>

        {/* Notes */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border rounded-lg p-2 text-sm"
            rows={3}
            placeholder="Instructions, commentaires..."
          />
        </div>

        {/* Total & Actions */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium">Total</span>
            <span className="text-xl font-bold text-[#2AA8DC]">{formatPrice(total)}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSubmit(true)}
              disabled={saving}
              className="flex-1 py-3 border-2 border-[#2AA8DC] text-[#2AA8DC] rounded-xl font-medium disabled:opacity-50"
            >
              {saving ? '...' : 'Brouillon'}
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={saving}
              className="flex-1 py-3 bg-[#2AA8DC] text-white rounded-xl font-medium disabled:opacity-50"
            >
              {saving ? '...' : 'Envoyer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
