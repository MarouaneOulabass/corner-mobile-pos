import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  const userRole = req.headers.get('x-user-role');
  const userStore = req.headers.get('x-user-store');

  if (!userId) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Sanitize query: allow only alphanumeric, spaces, hyphens, plus signs
  const sanitized = q.replace(/[^\w\s\-+().]/g, '').substring(0, 100);
  if (!sanitized) {
    return NextResponse.json({ results: [] });
  }

  const supabase = createServiceClient();
  const ilike = `%${sanitized}%`;

  interface SearchResult {
    type: string;
    id: string;
    title: string;
    subtitle: string;
    href: string;
  }

  const results: SearchResult[] = [];

  // Helper: apply store scoping for non-superadmin
  const storeFilter = userRole !== 'superadmin' && userStore ? userStore : null;

  try {
    // 1. Search products: by IMEI, brand, model
    let productQuery = supabase
      .from('products')
      .select('id, imei, brand, model, storage, color, condition, selling_price, status, store_id')
      .or(`imei.ilike.${ilike},brand.ilike.${ilike},model.ilike.${ilike}`)
      .limit(5);
    if (storeFilter) {
      productQuery = productQuery.eq('store_id', storeFilter);
    }
    const { data: products } = await productQuery;
    if (products) {
      for (const p of products) {
        const subtitle = [
          p.imei ? `IMEI: ${p.imei}` : null,
          p.storage,
          p.color,
          `${p.selling_price} MAD`,
          p.status,
        ].filter(Boolean).join(' - ');
        results.push({
          type: 'product',
          id: p.id,
          title: `${p.brand} ${p.model}`,
          subtitle,
          href: `/stock?highlight=${p.id}`,
        });
      }
    }

    // 2. Search customers: by name, phone
    const customerQuery = supabase
      .from('customers')
      .select('id, name, phone, email')
      .or(`name.ilike.${ilike},phone.ilike.${ilike}`)
      .limit(5);
    const { data: customers } = await customerQuery;
    if (customers) {
      for (const c of customers) {
        results.push({
          type: 'customer',
          id: c.id,
          title: c.name,
          subtitle: c.phone || c.email || '',
          href: `/customers?highlight=${c.id}`,
        });
      }
    }

    // 3. Search sales: by id prefix
    let salesQuery = supabase
      .from('sales')
      .select('id, total, payment_method, created_at, seller:users!sales_seller_id_fkey(name)')
      .ilike('id', ilike)
      .order('created_at', { ascending: false })
      .limit(3);
    if (storeFilter) {
      salesQuery = salesQuery.eq('store_id', storeFilter);
    }
    const { data: sales } = await salesQuery;
    if (sales) {
      for (const s of sales) {
        const sellerName = (s.seller as unknown as { name: string })?.name || '';
        const date = new Date(s.created_at).toLocaleDateString('fr-FR');
        results.push({
          type: 'sale',
          id: s.id,
          title: `Vente #${s.id.substring(0, 8)}`,
          subtitle: `${s.total} MAD - ${s.payment_method} - ${sellerName} - ${date}`,
          href: `/sales?highlight=${s.id}`,
        });
      }
    }

    // 4. Search repairs: by id prefix, customer phone
    let repairsQuery = supabase
      .from('repairs')
      .select('id, device_brand, device_model, status, created_at, customer:customers!repairs_customer_id_fkey(name, phone)')
      .or(`id.ilike.${ilike}`)
      .order('created_at', { ascending: false })
      .limit(3);
    if (storeFilter) {
      repairsQuery = repairsQuery.eq('store_id', storeFilter);
    }
    const { data: repairs } = await repairsQuery;
    if (repairs) {
      for (const r of repairs) {
        const customer = r.customer as unknown as { name: string; phone: string } | null;
        results.push({
          type: 'repair',
          id: r.id,
          title: `${r.device_brand} ${r.device_model}`,
          subtitle: `${r.status} - ${customer?.name || ''} ${customer?.phone || ''} - #${r.id.substring(0, 8)}`,
          href: `/repairs/${r.id}`,
        });
      }
    }

    // Also search repairs by customer phone (separate query)
    if (/\d/.test(sanitized)) {
      let repairPhoneQuery = supabase
        .from('repairs')
        .select('id, device_brand, device_model, status, created_at, customer:customers!repairs_customer_id_fkey(name, phone)')
        .limit(3);
      if (storeFilter) {
        repairPhoneQuery = repairPhoneQuery.eq('store_id', storeFilter);
      }
      // We can't filter on joined table directly with ilike easily,
      // so we search customers first then look up their repairs
      const { data: matchedCustomers } = await supabase
        .from('customers')
        .select('id')
        .ilike('phone', ilike)
        .limit(5);
      if (matchedCustomers && matchedCustomers.length > 0) {
        const customerIds = matchedCustomers.map(c => c.id);
        let repairByCustQuery = supabase
          .from('repairs')
          .select('id, device_brand, device_model, status, created_at, customer:customers!repairs_customer_id_fkey(name, phone)')
          .in('customer_id', customerIds)
          .order('created_at', { ascending: false })
          .limit(3);
        if (storeFilter) {
          repairByCustQuery = repairByCustQuery.eq('store_id', storeFilter);
        }
        const { data: repairsByPhone } = await repairByCustQuery;
        if (repairsByPhone) {
          const existingIds = new Set(results.filter(r => r.type === 'repair').map(r => r.id));
          for (const r of repairsByPhone) {
            if (existingIds.has(r.id)) continue;
            const customer = r.customer as unknown as { name: string; phone: string } | null;
            results.push({
              type: 'repair',
              id: r.id,
              title: `${r.device_brand} ${r.device_model}`,
              subtitle: `${r.status} - ${customer?.name || ''} ${customer?.phone || ''} - #${r.id.substring(0, 8)}`,
              href: `/repairs/${r.id}`,
            });
          }
        }
      }
    }

  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Erreur de recherche' }, { status: 500 });
  }

  return NextResponse.json({ results });
}
