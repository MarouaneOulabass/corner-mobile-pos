'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';
import { repairStatusLabels, repairStatusColors } from '@/lib/utils';
import GuidedTour from '@/components/features/GuidedTour';

interface DashboardData {
  salesToday: number;
  transactionCount: number;
  marginToday: number;
  marginPercent: number;
  inStockCount: number;
  soldThisWeek: number;
  repairsByStatus: Record<string, number>;
  topSeller: { name: string; total: number } | null;
}

interface CashSession {
  id: string;
  opened_at: string;
  opening_amount: number;
  status: string;
}

interface ClockStatus {
  clocked_in: boolean;
  clocked_in_at?: string;
}

interface StockAlerts {
  slowMoverCount: number;
  negativMarginCount: number;
}

interface ActivityItem {
  id: string;
  type: 'sale' | 'repair' | 'transfer';
  label: string;
  detail: string;
  created_at: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    salesToday: 0,
    transactionCount: 0,
    marginToday: 0,
    marginPercent: 0,
    inStockCount: 0,
    soldThisWeek: 0,
    repairsByStatus: {},
    topSeller: null,
  });
  const [stockAlerts, setStockAlerts] = useState<StockAlerts>({ slowMoverCount: 0, negativMarginCount: 0 });
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetchAll = useCallback(async () => {
    if (!user) return;
    const isInitial = lastRefresh === null;
    if (!isInitial) setIsRefreshing(true);
    await fetchDashboard();
    await Promise.all([fetchStockAlerts(), fetchActivities(), fetchCashSession(), fetchClockStatus()]);
    setLastRefresh(new Date());
    if (!isInitial) {
      setTimeout(() => setIsRefreshing(false), 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fetchAll]);

  async function fetchDashboard() {
    setLoading(true);
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startOfWeek = weekAgo.toISOString();

    const storeId = user!.store_id;

    // Fetch today's sales
    let salesQuery = supabase
      .from('sales')
      .select('id, total, discount_amount, seller_id, seller:users(name), items:sale_items(unit_price, quantity, product:products(purchase_price))')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    if (user!.role !== 'superadmin') {
      salesQuery = salesQuery.eq('store_id', storeId);
    }

    const { data: sales } = await salesQuery;

    let salesToday = 0;
    let marginToday = 0;
    const sellerTotals: Record<string, { name: string; total: number }> = {};

    if (sales) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const sale of sales as any[]) {
        salesToday += sale.total;

        // Calculate margin from items
        if (sale.items) {
          for (const item of sale.items) {
            const revenue = item.unit_price * item.quantity;
            const cost = item.product?.purchase_price ? item.product.purchase_price * item.quantity : 0;
            marginToday += revenue - cost;
          }
        }

        // Track seller totals
        const sellerName = sale.seller?.name || 'Inconnu';
        if (!sellerTotals[sale.seller_id]) {
          sellerTotals[sale.seller_id] = { name: sellerName, total: 0 };
        }
        sellerTotals[sale.seller_id].total += sale.total;
      }
    }

    const transactionCount = sales?.length || 0;
    const marginPercent = salesToday > 0 ? (marginToday / salesToday) * 100 : 0;

    // Top seller
    let topSeller: { name: string; total: number } | null = null;
    const sellerEntries = Object.values(sellerTotals);
    if (sellerEntries.length > 0) {
      topSeller = sellerEntries.reduce((best, s) => (s.total > best.total ? s : best));
    }

    // Stock count
    let stockQuery = supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'in_stock');

    if (user!.role !== 'superadmin') {
      stockQuery = stockQuery.eq('store_id', storeId);
    }

    const { count: inStockCount } = await stockQuery;

    // Sold this week
    let soldQuery = supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sold')
      .gte('updated_at', startOfWeek);

    if (user!.role !== 'superadmin') {
      soldQuery = soldQuery.eq('store_id', storeId);
    }

    const { count: soldThisWeek } = await soldQuery;

    // Open repairs by status
    let repairsQuery = supabase
      .from('repairs')
      .select('status')
      .not('status', 'in', '("delivered","cancelled")');

    if (user!.role !== 'superadmin') {
      repairsQuery = repairsQuery.eq('store_id', storeId);
    }

    const { data: repairs } = await repairsQuery;
    const repairsByStatus: Record<string, number> = {};
    if (repairs) {
      for (const r of repairs) {
        repairsByStatus[r.status] = (repairsByStatus[r.status] || 0) + 1;
      }
    }

    setData({
      salesToday,
      transactionCount,
      marginToday,
      marginPercent,
      inStockCount: inStockCount || 0,
      soldThisWeek: soldThisWeek || 0,
      repairsByStatus,
      topSeller,
    });
    setLoading(false);
  }

  async function fetchStockAlerts() {
    const storeId = user!.store_id;
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const cutoff = sixtyDaysAgo.toISOString();

    // Slow movers: in_stock and created more than 60 days ago
    let slowQuery = supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'in_stock')
      .lt('created_at', cutoff);

    if (user!.role !== 'superadmin') {
      slowQuery = slowQuery.eq('store_id', storeId);
    }

    const { count: slowMoverCount } = await slowQuery;

    // Negative margin: selling_price < purchase_price
    let marginQuery = supabase
      .from('products')
      .select('id, purchase_price, selling_price')
      .eq('status', 'in_stock');

    if (user!.role !== 'superadmin') {
      marginQuery = marginQuery.eq('store_id', storeId);
    }

    const { data: marginProducts } = await marginQuery;
    const negativMarginCount = marginProducts
      ? marginProducts.filter((p) => p.selling_price < p.purchase_price).length
      : 0;

    setStockAlerts({ slowMoverCount: slowMoverCount || 0, negativMarginCount });
  }

  async function fetchActivities() {
    const storeId = user!.store_id;
    const isSuperadmin = user!.role === 'superadmin';

    // Fetch latest 5 sales
    let salesQ = supabase
      .from('sales')
      .select('id, total, created_at, seller:users(name), items:sale_items(product:products(brand, model))')
      .order('created_at', { ascending: false })
      .limit(5);
    if (!isSuperadmin) salesQ = salesQ.eq('store_id', storeId);
    const { data: recentSales } = await salesQ;

    // Fetch latest 5 repairs
    let repairsQ = supabase
      .from('repairs')
      .select('id, device_brand, device_model, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    if (!isSuperadmin) repairsQ = repairsQ.eq('store_id', storeId);
    const { data: recentRepairs } = await repairsQ;

    // Fetch latest 5 transfers
    let transfersQ = supabase
      .from('transfers')
      .select('id, created_at, product:products(brand, model), to_store:stores!to_store_id(name)')
      .order('created_at', { ascending: false })
      .limit(5);
    if (!isSuperadmin) transfersQ = transfersQ.or(`from_store_id.eq.${storeId},to_store_id.eq.${storeId}`);
    const { data: recentTransfers } = await transfersQ;

    const items: ActivityItem[] = [];

    if (recentSales) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const s of recentSales as any[]) {
        const sellerName = s.seller?.name || 'Vendeur';
        const productName = s.items?.[0]?.product
          ? `${s.items[0].product.brand} ${s.items[0].product.model}`
          : 'Article';
        items.push({
          id: `sale-${s.id}`,
          type: 'sale',
          label: `${sellerName} a vendu ${productName}`,
          detail: formatPrice(s.total),
          created_at: s.created_at,
        });
      }
    }

    if (recentRepairs) {
      for (const r of recentRepairs) {
        items.push({
          id: `repair-${r.id}`,
          type: 'repair',
          label: `Nouveau ticket réparation`,
          detail: `${r.device_brand} ${r.device_model}`,
          created_at: r.created_at,
        });
      }
    }

    if (recentTransfers) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const t of recentTransfers as any[]) {
        const productName = t.product ? `${t.product.brand} ${t.product.model}` : 'Produit';
        const storeName = t.to_store?.name || '?';
        items.push({
          id: `transfer-${t.id}`,
          type: 'transfer',
          label: `Transfert ${productName}`,
          detail: `→ ${storeName}`,
          created_at: t.created_at,
        });
      }
    }

    // Sort by created_at desc, take top 5
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setActivities(items.slice(0, 5));
  }

  async function fetchCashSession() {
    try {
      const res = await fetch('/api/cash/sessions?status=open');
      if (res.ok) {
        const data = await res.json();
        const sessions = Array.isArray(data) ? data : data.sessions || [];
        setCashSession(sessions.length > 0 ? sessions[0] : null);
      } else {
        setCashSession(null);
      }
    } catch {
      setCashSession(null);
    }
  }

  async function fetchClockStatus() {
    try {
      const res = await fetch('/api/clock');
      if (res.ok) {
        const data = await res.json();
        setClockStatus(data);
      } else {
        setClockStatus(null);
      }
    } catch {
      setClockStatus(null);
    }
  }

  function formatDuration(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h${minutes > 0 ? minutes.toString().padStart(2, '0') : ''}`;
    return `${minutes}min`;
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-5 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded w-1/3 mb-3" />
            <div className="h-8 bg-gray-200 dark:bg-slate-600 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const greeting = getGreeting();
  const totalOpenRepairs = Object.values(data.repairsByStatus).reduce((a, b) => a + b, 0);

  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    const done = localStorage.getItem('corner_tour_done');
    if (!done && !loading && user) {
      setTimeout(() => setShowTour(true), 1500);
    }
  }, [loading, user]);

  return (
    <div className="p-4 space-y-4">
      {showTour && <GuidedTour onComplete={() => setShowTour(false)} />}
      {/* Welcome */}
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {greeting}, {user?.name?.split(' ')[0]}
          </h1>
          {lastRefresh && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Dernière maj: {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Sales Today */}
      <div
        data-tour="dashboard-sales"
        className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 transition-opacity duration-500"
        style={{ opacity: isRefreshing ? 0.6 : 1 }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Ventes aujourd&apos;hui</span>
          <span className="text-xs bg-[#2AA8DC]/10 text-[#2AA8DC] px-2 py-0.5 rounded-full font-medium">
            {data.transactionCount} transaction{data.transactionCount !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPrice(data.salesToday)}</p>
      </div>

      {/* Margin */}
      <div
        className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 transition-opacity duration-500"
        style={{ opacity: isRefreshing ? 0.6 : 1 }}
      >
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marge du jour</span>
        <div className="flex items-end gap-3 mt-1">
          <p className="text-2xl font-bold text-[#5BBF3E]">{formatPrice(data.marginToday)}</p>
          <span className="text-sm font-medium text-[#5BBF3E] mb-1">
            {data.marginPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Stock Summary */}
      <div
        className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 transition-opacity duration-500"
        style={{ opacity: isRefreshing ? 0.6 : 1 }}
      >
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 block">Stock</span>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.inStockCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">En stock</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.soldThisWeek}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Vendus cette semaine</p>
          </div>
        </div>
      </div>

      {/* Open Repairs */}
      <div
        data-tour="dashboard-repairs"
        className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 transition-opacity duration-500"
        style={{ opacity: isRefreshing ? 0.6 : 1 }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Réparations en cours</span>
          <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">
            {totalOpenRepairs}
          </span>
        </div>
        {totalOpenRepairs === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Aucune réparation en cours</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.repairsByStatus).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center gap-1.5 text-xs bg-gray-50 dark:bg-slate-900 rounded-full px-3 py-1.5"
              >
                <span className={`w-2 h-2 rounded-full ${repairStatusColors[status] || 'bg-gray-400'}`} />
                <span className="text-gray-700 dark:text-gray-200">{repairStatusLabels[status] || status}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Seller */}
      {data.topSeller && (
        <div className="bg-gradient-to-r from-[#2AA8DC] to-[#2AA8DC]/80 rounded-xl p-5 shadow-sm">
          <span className="text-sm font-medium text-white/80">Meilleur vendeur du jour</span>
          <div className="flex items-center justify-between mt-2">
            <p className="text-lg font-bold text-white">{data.topSeller.name}</p>
            <p className="text-lg font-bold text-white">{formatPrice(data.topSeller.total)}</p>
          </div>
        </div>
      )}

      {/* Cash Session Widget */}
      <div
        data-tour="dashboard-cash"
        className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 transition-opacity duration-500"
        style={{ opacity: isRefreshing ? 0.6 : 1 }}
      >
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">Caisse</span>
        {cashSession ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-sm text-gray-800 dark:text-gray-100">
                Caisse ouverte depuis {formatDuration(cashSession.opened_at)}
              </span>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{formatPrice(cashSession.opening_amount)}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Caisse fermee</span>
            </div>
            <a href="/cash" className="text-sm font-medium text-[#2AA8DC] hover:underline">Ouvrir</a>
          </div>
        )}
      </div>

      {/* Clock Status Widget */}
      <div
        className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 transition-opacity duration-500"
        style={{ opacity: isRefreshing ? 0.6 : 1 }}
      >
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">Pointage</span>
        {clockStatus?.clocked_in && clockStatus.clocked_in_at ? (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-sm text-gray-800 dark:text-gray-100">
              Pointe depuis {formatDuration(clockStatus.clocked_in_at)}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Non pointe</span>
            </div>
            <a href="/employees/clock" className="text-sm font-medium text-[#2AA8DC] hover:underline">Pointer</a>
          </div>
        )}
      </div>

      {/* Stock Alerts */}
      {(stockAlerts.slowMoverCount > 0 || stockAlerts.negativMarginCount > 0) && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚠</span>
            <span className="text-sm font-semibold text-orange-800">Alertes stock</span>
          </div>
          <div className="space-y-2">
            {stockAlerts.slowMoverCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-orange-700">Articles en stock depuis +60 jours</span>
                <span className="text-sm font-bold text-orange-800 bg-orange-100 px-2 py-0.5 rounded-full">
                  {stockAlerts.slowMoverCount}
                </span>
              </div>
            )}
            {stockAlerts.negativMarginCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-orange-700">Prix de vente &lt; prix d&apos;achat</span>
                <span className="text-sm font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                  {stockAlerts.negativMarginCount}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Feed */}
      {activities.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 block">Activité récente</span>
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      activity.type === 'sale'
                        ? 'bg-[#5BBF3E]'
                        : activity.type === 'repair'
                        ? 'bg-orange-400'
                        : 'bg-[#2AA8DC]'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-100 truncate">{activity.label}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{activity.detail}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(activity.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}
