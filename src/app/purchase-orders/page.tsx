'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PurchaseOrder, POStatus } from '@/types';
import { formatPrice, formatDate, poStatusLabels, poStatusColors } from '@/lib/utils';
import Link from 'next/link';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: 'Tous' },
  { key: 'draft', label: 'Brouillon' },
  { key: 'sent', label: 'Envoyes' },
  { key: 'partial', label: 'Partiels' },
  { key: 'received', label: 'Recus' },
];

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<(PurchaseOrder & { items_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab) params.set('status', activeTab);
      const res = await fetch(`/api/purchase-orders?${params}`);
      const data = await res.json();
      setOrders(data.purchase_orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (!user || (user.role !== 'superadmin' && user.role !== 'manager')) {
    return (
      <div className="p-4 text-center text-gray-500">
        Acces reserve aux managers
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-[#2AA8DC] text-white p-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Bons de commande</h1>
            <p className="text-sm opacity-80">{orders.length} bon(s)</p>
          </div>
          <Link
            href="/purchase-orders/new"
            className="bg-white text-[#2AA8DC] px-4 py-2 rounded-xl text-sm font-medium"
          >
            + Nouveau
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Status Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-[#2AA8DC] text-white'
                  : 'bg-white text-gray-600 border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Order List */}
        {loading ? (
          <div className="text-center text-gray-400 py-8">Chargement...</div>
        ) : orders.length === 0 ? (
          <div className="text-center text-gray-400 py-8">Aucun bon de commande</div>
        ) : (
          <div className="space-y-2">
            {orders.map((po) => (
              <Link
                key={po.id}
                href={`/purchase-orders/${po.id}`}
                className="block bg-white rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{po.po_number}</p>
                    <p className="text-xs text-gray-500">
                      {po.supplier?.name || 'Fournisseur'} — {formatDate(po.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#2AA8DC]">{formatPrice(po.total_amount)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full text-white ${poStatusColors[po.status as POStatus] || 'bg-gray-500'}`}>
                      {poStatusLabels[po.status as POStatus] || po.status}
                    </span>
                  </div>
                </div>
                {po.items_count != null && (
                  <p className="text-xs text-gray-400 mt-1">{po.items_count} article(s)</p>
                )}
                {po.creator && (
                  <p className="text-xs text-gray-400">Par: {po.creator.name}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
