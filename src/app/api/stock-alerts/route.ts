import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { StockAlertRule } from '@/types';

interface TriggeredAlert {
  rule: StockAlertRule;
  triggered_items: Record<string, unknown>[];
  count: number;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    const storeFilter = userRole !== 'superadmin' ? userStore : null;

    // Get all enabled rules for this store
    let rulesQuery = supabase
      .from('stock_alert_rules')
      .select('*')
      .eq('enabled', true);

    if (storeFilter) {
      rulesQuery = rulesQuery.eq('store_id', storeFilter);
    }

    const { data: rules, error: rulesError } = await rulesQuery;

    if (rulesError) {
      return NextResponse.json({ error: rulesError.message }, { status: 500 });
    }

    if (!rules || rules.length === 0) {
      return NextResponse.json({ alerts: [] });
    }

    const alerts: TriggeredAlert[] = [];

    for (const rule of rules as StockAlertRule[]) {
      let triggered: TriggeredAlert | null = null;

      switch (rule.alert_type) {
        case 'low_stock':
          triggered = await checkLowStock(supabase, rule);
          break;
        case 'aging_stock':
          triggered = await checkAgingStock(supabase, rule);
          break;
        case 'negative_margin':
          triggered = await checkNegativeMargin(supabase, rule);
          break;
        case 'warranty_expiring':
          triggered = await checkWarrantyExpiring(supabase, rule);
          break;
      }

      if (triggered && triggered.count > 0) {
        alerts.push(triggered);
      }
    }

    return NextResponse.json({ alerts });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

async function checkLowStock(
  supabase: ReturnType<typeof createServiceClient>,
  rule: StockAlertRule
): Promise<TriggeredAlert> {
  // Count products in stock by type/brand, compare to threshold
  let query = supabase
    .from('products')
    .select('id, brand, model, product_type, status', { count: 'exact' })
    .eq('store_id', rule.store_id)
    .eq('status', 'in_stock');

  if (rule.product_type) {
    query = query.eq('product_type', rule.product_type);
  }
  if (rule.brand) {
    query = query.ilike('brand', rule.brand);
  }

  const { data, count } = await query;
  const totalInStock = count || 0;

  if (totalInStock <= rule.threshold) {
    return {
      rule,
      triggered_items: data || [],
      count: totalInStock,
    };
  }

  return { rule, triggered_items: [], count: 0 };
}

async function checkAgingStock(
  supabase: ReturnType<typeof createServiceClient>,
  rule: StockAlertRule
): Promise<TriggeredAlert> {
  // Products in_stock for more than threshold days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - rule.threshold);

  let query = supabase
    .from('products')
    .select('id, brand, model, product_type, selling_price, created_at')
    .eq('store_id', rule.store_id)
    .eq('status', 'in_stock')
    .lt('created_at', cutoffDate.toISOString());

  if (rule.product_type) {
    query = query.eq('product_type', rule.product_type);
  }
  if (rule.brand) {
    query = query.ilike('brand', rule.brand);
  }

  const { data } = await query;
  const items = data || [];

  return {
    rule,
    triggered_items: items,
    count: items.length,
  };
}

async function checkNegativeMargin(
  supabase: ReturnType<typeof createServiceClient>,
  rule: StockAlertRule
): Promise<TriggeredAlert> {
  // Products where selling_price < purchase_price
  let query = supabase
    .from('products')
    .select('id, brand, model, purchase_price, selling_price, product_type')
    .eq('store_id', rule.store_id)
    .eq('status', 'in_stock');

  if (rule.product_type) {
    query = query.eq('product_type', rule.product_type);
  }
  if (rule.brand) {
    query = query.ilike('brand', rule.brand);
  }

  const { data } = await query;
  const items = (data || []).filter(
    (p) => p.selling_price < p.purchase_price
  );

  return {
    rule,
    triggered_items: items,
    count: items.length,
  };
}

async function checkWarrantyExpiring(
  supabase: ReturnType<typeof createServiceClient>,
  rule: StockAlertRule
): Promise<TriggeredAlert> {
  // Products where warranty expires within threshold days
  // warranty_months field on product + purchase_date
  let query = supabase
    .from('products')
    .select('id, brand, model, purchase_date, warranty_months, product_type')
    .eq('store_id', rule.store_id)
    .eq('status', 'in_stock')
    .not('warranty_months', 'is', null)
    .not('purchase_date', 'is', null);

  if (rule.product_type) {
    query = query.eq('product_type', rule.product_type);
  }
  if (rule.brand) {
    query = query.ilike('brand', rule.brand);
  }

  const { data } = await query;
  const now = new Date();
  const thresholdMs = rule.threshold * 24 * 60 * 60 * 1000;

  const items = (data || []).filter((p) => {
    if (!p.purchase_date || !p.warranty_months) return false;
    const purchaseDate = new Date(p.purchase_date);
    const warrantyEnd = new Date(purchaseDate);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + p.warranty_months);
    const timeLeft = warrantyEnd.getTime() - now.getTime();
    return timeLeft > 0 && timeLeft <= thresholdMs;
  });

  return {
    rule,
    triggered_items: items,
    count: items.length,
  };
}
