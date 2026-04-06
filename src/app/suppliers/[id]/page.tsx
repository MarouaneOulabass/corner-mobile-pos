'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Supplier, PurchaseOrder } from '@/types';
import { formatPrice, formatDate, poStatusLabels, poStatusColors } from '@/lib/utils';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function SupplierDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const id = params.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', email: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers/${id}`);
      const data = await res.json();
      setSupplier(data.supplier || null);
      setOrders(data.purchase_orders || []);
      if (data.supplier) {
        setForm({
          name: data.supplier.name || '',
          contact_name: data.supplier.contact_name || '',
          phone: data.supplier.phone || '',
          email: data.supplier.email || '',
          address: data.supplier.address || '',
          notes: data.supplier.notes || '',
        });
      }
    } catch {
      setSupplier(null);
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setEditing(false);
        fetchData();
      }
    } finally {
      setSaving(false);
    }
  };

  const totalSpent = orders.reduce((s, o) => s + (o.total_amount || 0), 0);

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Chargement...</p>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Fournisseur introuvable</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-[#2AA8DC] text-white p-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <Link href="/suppliers" className="text-sm opacity-80">&larr; Fournisseurs</Link>
            <h1 className="text-xl font-bold">{supplier.name}</h1>
          </div>
          {!editing && (user.role === 'superadmin' || user.role === 'manager') && (
            <button
              onClick={() => setEditing(true)}
              className="bg-white text-[#2AA8DC] px-4 py-2 rounded-xl text-sm font-medium"
            >
              Modifier
            </button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Supplier Info */}
        {editing ? (
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
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
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 bg-[#2AA8DC] text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 border rounded-xl text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
            {supplier.contact_name && (
              <p className="text-sm"><span className="text-gray-500">Contact:</span> {supplier.contact_name}</p>
            )}
            {supplier.phone && (
              <p className="text-sm"><span className="text-gray-500">Tel:</span> {supplier.phone}</p>
            )}
            {supplier.email && (
              <p className="text-sm"><span className="text-gray-500">Email:</span> {supplier.email}</p>
            )}
            {supplier.address && (
              <p className="text-sm"><span className="text-gray-500">Adresse:</span> {supplier.address}</p>
            )}
            {supplier.notes && (
              <p className="text-sm text-gray-500 mt-2">{supplier.notes}</p>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-xs text-gray-500">Bons de commande</p>
            <p className="text-lg font-bold">{orders.length}</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-xs text-gray-500">Total depense</p>
            <p className="text-lg font-bold text-[#2AA8DC]">{formatPrice(totalSpent)}</p>
          </div>
        </div>

        {/* Purchase Orders */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-medium text-sm mb-3">Bons de commande</h3>
          {orders.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucun bon de commande</p>
          ) : (
            <div className="space-y-2">
              {orders.map((po) => (
                <Link
                  key={po.id}
                  href={`/purchase-orders/${po.id}`}
                  className="block border-b last:border-0 pb-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{po.po_number}</p>
                      <p className="text-xs text-gray-500">{formatDate(po.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatPrice(po.total_amount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full text-white ${poStatusColors[po.status] || 'bg-gray-500'}`}>
                        {poStatusLabels[po.status] || po.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
