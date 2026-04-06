'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PurchaseOrder, POItem, POStatus } from '@/types';
import { formatPrice, formatDate, poStatusLabels, poStatusColors } from '@/lib/utils';
import { useParams, useRouter } from 'next/navigation';

export default function PurchaseOrderDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({});
  const [createProducts, setCreateProducts] = useState(false);

  const fetchPO = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/purchase-orders/${id}`);
      const data = await res.json();
      setPO(data.id ? data : null);

      // Initialize receive quantities
      if (data.items) {
        const qty: Record<string, number> = {};
        for (const item of data.items) {
          qty[item.id] = 0;
        }
        setReceiveQty(qty);
      }
    } catch {
      setPO(null);
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    fetchPO();
  }, [fetchPO]);

  const changeStatus = async (newStatus: string) => {
    setActing(true);
    try {
      await fetch(`/api/purchase-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchPO();
    } finally {
      setActing(false);
    }
  };

  const handleReceive = async () => {
    const items = Object.entries(receiveQty)
      .filter(([, qty]) => qty > 0)
      .map(([po_item_id, quantity_received]) => ({ po_item_id, quantity_received }));

    if (items.length === 0) return;

    setActing(true);
    try {
      await fetch(`/api/purchase-orders/${id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, create_products: createProducts }),
      });
      setShowReceive(false);
      fetchPO();
    } finally {
      setActing(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Chargement...</p>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Bon de commande introuvable</p>
      </div>
    );
  }

  const canSend = po.status === 'draft';
  const canReceive = po.status === 'sent' || po.status === 'partial';
  const canCancel = po.status !== 'received' && po.status !== 'cancelled';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-[#2AA8DC] text-white p-4">
        <div className="max-w-lg mx-auto">
          <button onClick={() => router.push('/purchase-orders')} className="text-sm opacity-80">
            &larr; Bons de commande
          </button>
          <div className="flex items-center justify-between mt-1">
            <h1 className="text-xl font-bold">{po.po_number}</h1>
            <span className={`text-xs px-3 py-1 rounded-full text-white ${poStatusColors[po.status as POStatus] || 'bg-gray-500'}`}>
              {poStatusLabels[po.status as POStatus] || po.status}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* PO Info */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Fournisseur</span>
            <span className="font-medium">{po.supplier?.name || '--'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Date</span>
            <span>{formatDate(po.created_at)}</span>
          </div>
          {po.expected_date && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Date prevue</span>
              <span>{formatDate(po.expected_date)}</span>
            </div>
          )}
          {po.received_at && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Recu le</span>
              <span>{formatDate(po.received_at)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Cree par</span>
            <span>{po.creator?.name || '--'}</span>
          </div>
          <div className="flex justify-between text-sm font-medium border-t pt-2">
            <span>Total</span>
            <span className="text-[#2AA8DC]">{formatPrice(po.total_amount)}</span>
          </div>
          {po.notes && (
            <p className="text-xs text-gray-500 border-t pt-2">{po.notes}</p>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-medium text-sm mb-3">Articles</h3>
          <div className="space-y-3">
            {(po.items || []).map((item: POItem) => {
              const remaining = item.quantity_ordered - item.quantity_received;
              return (
                <div key={item.id} className="border-b last:border-0 pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.description}</p>
                      <p className="text-xs text-gray-500">
                        {item.brand && `${item.brand} `}
                        {item.model && `${item.model} `}
                        — {formatPrice(item.unit_cost)}/u
                      </p>
                    </div>
                    <p className="font-bold text-sm">{formatPrice(item.total_cost)}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#5BBF3E] h-2 rounded-full transition-all"
                        style={{ width: `${(item.quantity_received / item.quantity_ordered) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {item.quantity_received}/{item.quantity_ordered}
                    </span>
                  </div>
                  {showReceive && remaining > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-xs text-gray-500">Recevoir:</label>
                      <input
                        type="number"
                        min="0"
                        max={remaining}
                        value={receiveQty[item.id] || 0}
                        onChange={(e) =>
                          setReceiveQty((prev) => ({
                            ...prev,
                            [item.id]: Math.min(parseInt(e.target.value) || 0, remaining),
                          }))
                        }
                        className="w-20 border rounded-lg p-1 text-sm text-center"
                      />
                      <span className="text-xs text-gray-400">/ {remaining} restant</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Receive Form */}
        {showReceive && (
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createProducts}
                onChange={(e) => setCreateProducts(e.target.checked)}
              />
              Creer les produits en stock automatiquement
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleReceive}
                disabled={acting}
                className="flex-1 py-2 bg-[#5BBF3E] text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {acting ? 'Traitement...' : 'Confirmer reception'}
              </button>
              <button
                onClick={() => setShowReceive(false)}
                className="px-4 py-2 border rounded-xl text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {canSend && (
            <button
              onClick={() => changeStatus('sent')}
              disabled={acting}
              className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium disabled:opacity-50"
            >
              Envoyer
            </button>
          )}
          {canReceive && !showReceive && (
            <button
              onClick={() => setShowReceive(true)}
              disabled={acting}
              className="flex-1 py-3 bg-[#5BBF3E] text-white rounded-xl font-medium disabled:opacity-50"
            >
              Receptionner
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => changeStatus('cancelled')}
              disabled={acting}
              className="py-3 px-4 bg-red-500 text-white rounded-xl font-medium disabled:opacity-50"
            >
              Annuler
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
