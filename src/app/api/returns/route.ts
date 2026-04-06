import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

interface ReturnItemInput {
  product_id: string;
  sale_item_id: string;
  quantity: number;
  refund_amount: number;
  restocked?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const customer_id = searchParams.get('customer_id');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    let query = supabase
      .from('returns')
      .select(
        '*, sale:sales(id, total, created_at, seller:users!sales_seller_id_fkey(id, name)), customer:customers(id, name, phone), processor:users!returns_processed_by_fkey(id, name), items:return_items(*, product:products(id, brand, model, imei, product_type))',
        { count: 'exact' }
      );

    // Store scoping
    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    }

    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to + 'T23:59:59');
    if (customer_id) query = query.eq('customer_id', customer_id);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ returns: data || [], total: count || 0 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const userId = request.headers.get('x-user-id');
    const storeId = request.headers.get('x-user-store');

    if (!userId || !storeId) {
      return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 });
    }

    // --- VALIDATION ---
    const { sale_id, return_type, reason, reason_category, refund_method, items, notes } = body;

    if (!sale_id) {
      return NextResponse.json({ error: 'sale_id requis' }, { status: 400 });
    }

    const validReturnTypes = ['full', 'partial', 'exchange'];
    if (!return_type || !validReturnTypes.includes(return_type)) {
      return NextResponse.json({ error: 'Type de retour invalide' }, { status: 400 });
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: 'Raison requise' }, { status: 400 });
    }

    const validRefundMethods = ['cash', 'card', 'store_credit', 'exchange'];
    if (!refund_method || !validRefundMethods.includes(refund_method)) {
      return NextResponse.json({ error: 'Méthode de remboursement invalide' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Au moins un article à retourner est requis' }, { status: 400 });
    }

    // --- VERIFY SALE EXISTS ---
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*, items:sale_items(*, product:products(id, product_type, status, imei))')
      .eq('id', sale_id)
      .single();

    if (saleError || !sale) {
      return NextResponse.json({ error: 'Vente introuvable' }, { status: 404 });
    }

    // Build a map of sale items for validation
    interface SaleItemRecord {
      id: string;
      product_id: string;
      quantity: number;
      unit_price: number;
      product: { id: string; product_type: string; status: string; imei?: string } | null;
    }
    const saleItemMap = new Map<string, SaleItemRecord>(
      (sale.items || []).map((si: SaleItemRecord) => [si.id, si])
    );

    // --- VALIDATE ITEMS ---
    let totalRefund = 0;
    for (const item of items as ReturnItemInput[]) {
      if (!item.product_id || !item.sale_item_id) {
        return NextResponse.json({ error: 'product_id et sale_item_id requis pour chaque article' }, { status: 400 });
      }
      if (!item.quantity || item.quantity < 1 || !Number.isInteger(item.quantity)) {
        return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 });
      }
      if (item.refund_amount == null || item.refund_amount < 0) {
        return NextResponse.json({ error: 'Montant de remboursement invalide' }, { status: 400 });
      }

      // Verify sale_item belongs to sale
      const saleItem = saleItemMap.get(item.sale_item_id);
      if (!saleItem) {
        return NextResponse.json({ error: `Article ${item.sale_item_id} n'appartient pas à cette vente` }, { status: 400 });
      }

      // Verify product matches
      if (saleItem.product_id !== item.product_id) {
        return NextResponse.json({ error: `Le produit ne correspond pas à l'article de vente` }, { status: 400 });
      }

      // Verify quantity doesn't exceed original
      if (item.quantity > saleItem.quantity) {
        return NextResponse.json({ error: `Quantité retournée dépasse la quantité vendue` }, { status: 400 });
      }

      totalRefund += item.refund_amount;
    }

    // --- CREATE RETURN RECORD ---
    const { data: returnRecord, error: returnError } = await supabase
      .from('returns')
      .insert({
        sale_id,
        store_id: storeId,
        processed_by: userId,
        customer_id: sale.customer_id || null,
        return_type,
        reason,
        reason_category: reason_category || null,
        refund_amount: totalRefund,
        refund_method,
        notes: notes || null,
      })
      .select('*')
      .single();

    if (returnError) {
      return NextResponse.json({ error: 'Erreur création retour: ' + returnError.message }, { status: 500 });
    }

    // --- CREATE RETURN ITEMS ---
    const returnItems = (items as ReturnItemInput[]).map((item) => ({
      return_id: returnRecord.id,
      product_id: item.product_id,
      sale_item_id: item.sale_item_id,
      quantity: item.quantity,
      refund_amount: item.refund_amount,
      restocked: item.restocked !== false, // default true
    }));

    const { error: itemsError } = await supabase.from('return_items').insert(returnItems);

    if (itemsError) {
      // Rollback return
      await supabase.from('returns').delete().eq('id', returnRecord.id);
      return NextResponse.json({ error: 'Erreur articles retour: ' + itemsError.message }, { status: 500 });
    }

    // --- RESTOCK ITEMS (phones with restocked=true → back to in_stock) ---
    for (const item of items as ReturnItemInput[]) {
      if (item.restocked !== false) {
        const saleItem = saleItemMap.get(item.sale_item_id);
        if (saleItem && saleItem.product?.product_type === 'phone') {
          await supabase
            .from('products')
            .update({ status: 'in_stock', updated_at: new Date().toISOString() })
            .eq('id', item.product_id)
            .eq('status', 'sold');
        }
      }
    }

    // --- IF STORE CREDIT: add to customer balance ---
    if (refund_method === 'store_credit' && sale.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('store_credit')
        .eq('id', sale.customer_id)
        .single();

      if (customer) {
        const newCredit = (customer.store_credit || 0) + totalRefund;
        await supabase
          .from('customers')
          .update({ store_credit: newCredit })
          .eq('id', sale.customer_id);
      }
    }

    // --- UPDATE SALE with return_id ---
    await supabase
      .from('sales')
      .update({ return_id: returnRecord.id })
      .eq('id', sale_id);

    // --- JOURNAL ---
    void journalWrite({
      event_type: 'return_created',
      entity_id: returnRecord.id,
      entity_type: 'return',
      user_id: userId,
      store_id: storeId,
      data: { ...returnRecord, items: returnItems },
    });

    // --- NOTIFY MANAGERS ---
    const { data: managers } = await supabase
      .from('users')
      .select('id')
      .eq('store_id', storeId)
      .in('role', ['manager', 'superadmin']);

    if (managers && managers.length > 0) {
      const notifications = managers
        .filter((m) => m.id !== userId)
        .map((m) => ({
          user_id: m.id,
          type: 'return_processed' as const,
          title: 'Retour traité',
          message: `Un retour de ${totalRefund} MAD a été traité (${return_type}).`,
          read: false,
          data: { return_id: returnRecord.id, sale_id },
        }));

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }
    }

    // --- FETCH COMPLETE RETURN ---
    const { data: completeReturn } = await supabase
      .from('returns')
      .select(
        '*, sale:sales(id, total, created_at), customer:customers(id, name, phone), processor:users!returns_processed_by_fkey(id, name), items:return_items(*, product:products(id, brand, model, imei, product_type))'
      )
      .eq('id', returnRecord.id)
      .single();

    return NextResponse.json(completeReturn || returnRecord, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
