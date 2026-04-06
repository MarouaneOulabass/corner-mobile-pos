import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';
import { generatePONumber } from '@/lib/utils';

interface POItemInput {
  description: string;
  product_type: string;
  brand?: string;
  model?: string;
  quantity_ordered: number;
  unit_cost: number;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    const status = searchParams.get('status');
    const supplier_id = searchParams.get('supplier_id');

    let query = supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(id, name), items:po_items(id), creator:users(id, name)')
      .order('created_at', { ascending: false });

    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    }

    if (status) query = query.eq('status', status);
    if (supplier_id) query = query.eq('supplier_id', supplier_id);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Add items_count to each PO
    const orders = (data || []).map((po) => ({
      ...po,
      items_count: po.items?.length || 0,
      items: undefined,
    }));

    return NextResponse.json({ purchase_orders: orders });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userId = request.headers.get('x-user-id');
    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    if (!userId || !userStore) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }
    if (userRole !== 'superadmin' && userRole !== 'manager') {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }

    const body = await request.json();
    const { supplier_id, items, notes, expected_date } = body;

    if (!supplier_id) {
      return NextResponse.json({ error: 'Fournisseur requis' }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Au moins un article requis' }, { status: 400 });
    }

    // Validate items
    for (const item of items as POItemInput[]) {
      if (!item.description) {
        return NextResponse.json({ error: 'Description requise pour chaque article' }, { status: 400 });
      }
      if (!item.quantity_ordered || item.quantity_ordered < 1) {
        return NextResponse.json({ error: 'Quantite invalide' }, { status: 400 });
      }
      if (item.unit_cost == null || item.unit_cost < 0) {
        return NextResponse.json({ error: 'Cout unitaire invalide' }, { status: 400 });
      }
    }

    // Verify supplier exists
    const { data: supplier, error: supError } = await supabase
      .from('suppliers')
      .select('id')
      .eq('id', supplier_id)
      .single();

    if (supError || !supplier) {
      return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 });
    }

    // Generate PO number
    const { count } = await supabase
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true });

    const poNumber = generatePONumber((count || 0) + 1);

    // Calculate total
    const totalAmount = (items as POItemInput[]).reduce(
      (sum, item) => sum + item.quantity_ordered * item.unit_cost, 0
    );

    // Create PO
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        supplier_id,
        store_id: userStore,
        created_by: userId,
        po_number: poNumber,
        status: 'draft',
        total_amount: Math.round(totalAmount * 100) / 100,
        notes: notes || null,
        expected_date: expected_date || null,
      })
      .select('*')
      .single();

    if (poError) return NextResponse.json({ error: poError.message }, { status: 500 });

    // Create PO items
    const poItems = (items as POItemInput[]).map((item) => ({
      po_id: po.id,
      description: item.description,
      product_type: item.product_type || 'accessory',
      brand: item.brand || null,
      model: item.model || null,
      quantity_ordered: item.quantity_ordered,
      quantity_received: 0,
      unit_cost: item.unit_cost,
      total_cost: Math.round(item.quantity_ordered * item.unit_cost * 100) / 100,
    }));

    const { error: itemsError } = await supabase.from('po_items').insert(poItems);

    if (itemsError) {
      await supabase.from('purchase_orders').delete().eq('id', po.id);
      return NextResponse.json({ error: 'Erreur articles: ' + itemsError.message }, { status: 500 });
    }

    // Fetch complete PO
    const { data: completePO } = await supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(*), items:po_items(*), creator:users(id, name)')
      .eq('id', po.id)
      .single();

    void journalWrite({
      event_type: 'purchase_order_created',
      entity_id: po.id,
      entity_type: 'purchase_order',
      user_id: userId,
      store_id: userStore,
      data: { purchase_order: completePO || po },
    });

    return NextResponse.json(completePO || po, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
