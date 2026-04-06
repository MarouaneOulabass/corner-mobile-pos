import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { jwtVerify } from 'jose';

function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('NEXTAUTH_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

async function verifyPortalToken(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.type !== 'portal' || !payload.sub) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const customerId = await verifyPortalToken(request);
    if (!customerId) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const sections = searchParams.get('sections')?.split(',') || [
      'purchases',
      'repairs',
      'warranties',
      'loyalty',
    ];

    // Always fetch customer profile
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id, name, phone, email, loyalty_tier, loyalty_points, store_credit')
      .eq('id', customerId)
      .single();

    if (custErr || !customer) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }

    const result: Record<string, unknown> = {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        loyalty_tier: customer.loyalty_tier || 'bronze',
        loyalty_points: customer.loyalty_points || 0,
        store_credit: customer.store_credit || 0,
      },
    };

    // Purchases
    if (sections.includes('purchases')) {
      const { data: sales } = await supabase
        .from('sales')
        .select(
          'id, total, discount_amount, payment_method, created_at, items:sale_items(id, quantity, unit_price, product:products(brand, model, product_type))'
        )
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(20);

      result.purchases = sales || [];
    }

    // Repairs
    if (sections.includes('repairs')) {
      const { data: repairs } = await supabase
        .from('repairs')
        .select(
          'id, device_brand, device_model, problem, status, estimated_cost, final_cost, deposit, created_at, updated_at, estimated_completion_date, status_logs:repair_status_log(status, changed_at, notes)'
        )
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(20);

      result.repairs = repairs || [];
    }

    // Warranties (products purchased with warranty_months)
    if (sections.includes('warranties')) {
      const { data: sales } = await supabase
        .from('sales')
        .select(
          'id, created_at, items:sale_items(id, product:products(id, brand, model, warranty_months, product_type))'
        )
        .eq('customer_id', customerId);

      const warranties: Array<{
        product_id: string;
        brand: string;
        model: string;
        purchase_date: string;
        warranty_months: number;
        warranty_end: string;
        under_warranty: boolean;
      }> = [];

      if (sales) {
        for (const sale of sales) {
          const items = (sale as Record<string, unknown>).items as Array<{
            product: {
              id: string;
              brand: string;
              model: string;
              warranty_months: number | null;
              product_type: string;
            } | null;
          }> | undefined;

          if (!items) continue;
          for (const item of items) {
            if (item.product?.warranty_months && item.product.warranty_months > 0) {
              const purchaseDate = new Date(sale.created_at);
              const warrantyEnd = new Date(purchaseDate);
              warrantyEnd.setMonth(warrantyEnd.getMonth() + item.product.warranty_months);
              warranties.push({
                product_id: item.product.id,
                brand: item.product.brand,
                model: item.product.model,
                purchase_date: sale.created_at,
                warranty_months: item.product.warranty_months,
                warranty_end: warrantyEnd.toISOString(),
                under_warranty: warrantyEnd > new Date(),
              });
            }
          }
        }
      }

      result.warranties = warranties;
    }

    // Loyalty
    if (sections.includes('loyalty')) {
      const { data: transactions } = await supabase
        .from('loyalty_transactions')
        .select('id, type, points, balance_after, description, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(20);

      result.loyalty_transactions = transactions || [];
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
