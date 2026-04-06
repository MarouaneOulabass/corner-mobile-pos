'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  formatPrice,
  formatDate,
  formatDateTime,
  repairStatusLabels,
  repairStatusColors,
  loyaltyTierLabels,
  loyaltyTierColors,
} from '@/lib/utils';

interface PortalCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  loyalty_tier: string;
  loyalty_points: number;
  store_credit: number;
}

interface Purchase {
  id: string;
  total: number;
  discount_amount: number;
  payment_method: string;
  created_at: string;
  items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    product: { brand: string; model: string; product_type: string } | null;
  }>;
}

interface PortalRepair {
  id: string;
  device_brand: string;
  device_model: string;
  problem: string;
  status: string;
  estimated_cost: number | null;
  final_cost: number | null;
  deposit: number | null;
  created_at: string;
  updated_at: string;
  estimated_completion_date: string | null;
  status_logs: Array<{ status: string; changed_at: string; notes: string | null }>;
}

interface Warranty {
  product_id: string;
  brand: string;
  model: string;
  purchase_date: string;
  warranty_months: number;
  warranty_end: string;
  under_warranty: boolean;
}

interface LoyaltyTx {
  id: string;
  type: string;
  points: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

type Tab = 'purchases' | 'repairs' | 'warranties' | 'loyalty';

export default function PortalDashboardPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [repairs, setRepairs] = useState<PortalRepair[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [loyaltyTx, setLoyaltyTx] = useState<LoyaltyTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('purchases');

  useEffect(() => {
    const token = localStorage.getItem('portal_token');
    const stored = localStorage.getItem('portal_customer');

    if (!token || !stored) {
      router.push('/portal');
      return;
    }

    setCustomer(JSON.parse(stored));
    fetchData(token);
  }, []);

  const fetchData = async (token: string) => {
    try {
      const res = await fetch('/api/portal/data?sections=purchases,repairs,warranties,loyalty', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('portal_token');
          localStorage.removeItem('portal_customer');
          router.push('/portal');
          return;
        }
        return;
      }

      const data = await res.json();
      if (data.customer) setCustomer(data.customer);
      setPurchases(data.purchases || []);
      setRepairs(data.repairs || []);
      setWarranties(data.warranties || []);
      setLoyaltyTx(data.loyalty_transactions || []);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_customer');
    router.push('/portal');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!customer) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'purchases', label: 'Achats' },
    { key: 'repairs', label: 'Reparations' },
    { key: 'warranties', label: 'Garanties' },
    { key: 'loyalty', label: 'Points' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#2AA8DC] text-white px-4 pt-6 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-sm font-bold">CM</span>
              </div>
              <span className="text-sm font-medium">Corner Mobile</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-white/80 text-sm hover:text-white"
            >
              Deconnexion
            </button>
          </div>

          <h1 className="text-xl font-bold">Bonjour, {customer.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                loyaltyTierColors[customer.loyalty_tier] || 'bg-white/20 text-white'
              }`}
            >
              {loyaltyTierLabels[customer.loyalty_tier] || customer.loyalty_tier}
            </span>
            <span className="text-white/80 text-sm">
              {customer.loyalty_points} points
            </span>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="max-w-lg mx-auto -mt-4">
        <div className="bg-white rounded-xl shadow-sm mx-4 p-1 flex">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-[#2AA8DC] text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto p-4">
        {/* Purchases */}
        {activeTab === 'purchases' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-800">Mes achats</h2>
            {purchases.length === 0 ? (
              <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-400">
                Aucun achat enregistre
              </div>
            ) : (
              purchases.map(sale => (
                <div key={sale.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs text-gray-400">{formatDateTime(sale.created_at)}</p>
                    <p className="font-semibold text-[#2AA8DC]">{formatPrice(sale.total)}</p>
                  </div>
                  {sale.items.map(item => (
                    <div key={item.id} className="text-sm text-gray-600">
                      {item.product
                        ? `${item.product.brand} ${item.product.model}`
                        : 'Article'}
                      {item.quantity > 1 && ` x${item.quantity}`}
                      <span className="text-gray-400 ml-2">{formatPrice(item.unit_price)}</span>
                    </div>
                  ))}
                  {sale.discount_amount > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      Remise: -{formatPrice(sale.discount_amount)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Repairs */}
        {activeTab === 'repairs' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-800">Mes reparations</h2>
            {repairs.length === 0 ? (
              <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-400">
                Aucune reparation
              </div>
            ) : (
              repairs.map(repair => (
                <div key={repair.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-sm">
                        {repair.device_brand} {repair.device_model}
                      </p>
                      <p className="text-xs text-gray-400">{repair.problem}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs text-white ${
                        repairStatusColors[repair.status] || 'bg-gray-500'
                      }`}
                    >
                      {repairStatusLabels[repair.status] || repair.status}
                    </span>
                  </div>

                  {/* Status timeline */}
                  {repair.status_logs && repair.status_logs.length > 0 && (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">Historique</p>
                      <div className="space-y-2">
                        {repair.status_logs
                          .sort(
                            (a, b) =>
                              new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
                          )
                          .map((log, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <div className="mt-1">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    repairStatusColors[log.status] || 'bg-gray-400'
                                  }`}
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between">
                                  <p className="text-xs font-medium">
                                    {repairStatusLabels[log.status] || log.status}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {formatDate(log.changed_at)}
                                  </p>
                                </div>
                                {log.notes && (
                                  <p className="text-xs text-gray-400">{log.notes}</p>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between mt-3 text-xs text-gray-400">
                    <span>Cree le {formatDate(repair.created_at)}</span>
                    {repair.estimated_cost && (
                      <span>Estimation: {formatPrice(repair.estimated_cost)}</span>
                    )}
                  </div>

                  {/* Track link */}
                  <a
                    href={`/track?repair=${repair.id}`}
                    className="block mt-2 text-center text-xs text-[#2AA8DC] font-medium"
                  >
                    Suivre en temps reel
                  </a>
                </div>
              ))
            )}
          </div>
        )}

        {/* Warranties */}
        {activeTab === 'warranties' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-800">Mes garanties</h2>
            {warranties.length === 0 ? (
              <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-400">
                Aucun produit sous garantie
              </div>
            ) : (
              warranties.map((w, idx) => (
                <div key={idx} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">
                        {w.brand} {w.model}
                      </p>
                      <p className="text-xs text-gray-400">
                        Achete le {formatDate(w.purchase_date)}
                      </p>
                      <p className="text-xs text-gray-400">
                        Garantie {w.warranty_months} mois - expire le {formatDate(w.warranty_end)}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        w.under_warranty
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {w.under_warranty ? 'Sous garantie' : 'Expiree'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Loyalty */}
        {activeTab === 'loyalty' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-800">Mes points fidelite</h2>

            {/* Points balance card */}
            <div className="bg-white rounded-xl p-4 shadow-sm text-center">
              <p className="text-4xl font-bold text-[#2AA8DC]">{customer.loyalty_points}</p>
              <p className="text-sm text-gray-500 mt-1">Points disponibles</p>
              <span
                className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${
                  loyaltyTierColors[customer.loyalty_tier] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {loyaltyTierLabels[customer.loyalty_tier] || customer.loyalty_tier}
              </span>
            </div>

            {/* Transactions */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-medium text-sm mb-3">Historique des points</h3>
              {loyaltyTx.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  Aucune transaction
                </p>
              ) : (
                <div className="space-y-2">
                  {loyaltyTx.map(tx => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <p className="text-sm">
                          {tx.type === 'earn' && 'Points gagnes'}
                          {tx.type === 'redeem' && 'Points utilises'}
                          {tx.type === 'bonus' && 'Bonus'}
                          {tx.type === 'adjustment' && 'Ajustement'}
                          {tx.type === 'expire' && 'Points expires'}
                        </p>
                        {tx.description && (
                          <p className="text-xs text-gray-400">{tx.description}</p>
                        )}
                        <p className="text-xs text-gray-300">{formatDate(tx.created_at)}</p>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          tx.points > 0 ? 'text-green-600' : 'text-red-500'
                        }`}
                      >
                        {tx.points > 0 ? '+' : ''}{tx.points}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
