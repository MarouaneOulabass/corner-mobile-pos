import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

interface ReceiveItemInput {
  po_item_id: string;
  quantity_received: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const { items, create_products } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Articles requis' }, { status: 400 });
    }

    // Get the PO with its items
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('*, items:po_items(*)')
      .eq('id', id)
      .single();

    if (poError || !po) {
      return NextResponse.json({ error: 'Bon de commande introuvable' }, { status: 404 });
    }

    if (po.status === 'received' || po.status === 'cancelled') {
      return NextResponse.json({ error: 'Ce bon de commande ne peut plus etre receptionne' }, { status: 400 });
    }

    const poItemMap = new Map((po.items || []).map((item: Record<string, unknown>) => [item.id, item]));

    // Update each item's quantity_received
    for (const input of items as ReceiveItemInput[]) {
      const poItem = poItemMap.get(input.po_item_id) as Record<string, unknown> | undefined;
      if (!poItem) {
        return NextResponse.json(
          { error: `Article ${input.po_item_id} introuvable dans ce bon` },
          { status: 404 }
        );
      }

      if (input.quantity_received < 0) {
        return NextResponse.json({ error: 'Quantite invalide' }, { status: 400 });
      }

      const newReceived = (poItem.quantity_received as number) + input.quantity_received;
      if (newReceived > (poItem.quantity_ordered as number)) {
        return NextResponse.json(
          { error: `Quantite recue depasse la quantite commandee pour "${poItem.description}"` },
          { status: 400 }
        );
      }

      await supabase
        .from('po_items')
        .update({ quantity_received: newReceived })
        .eq('id', input.po_item_id);
    }

    // Check if all items are fully received
    const { data: updatedItems } = await supabase
      .from('po_items')
      .select('quantity_ordered, quantity_received')
      .eq('po_id', id);

    const allReceived = (updatedItems || []).every(
      (item) => item.quantity_received >= item.quantity_ordered
    );
    const someReceived = (updatedItems || []).some(
      (item) => item.quantity_received > 0
    );

    let newStatus = po.status;
    if (allReceived) {
      newStatus = 'received';
    } else if (someReceived) {
      newStatus = 'partial';
    }

    const poUpdates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'received') {
      poUpdates.received_at = new Date().toISOString();
    }

    await supabase.from('purchase_orders').update(poUpdates).eq('id', id);

    // Optionally create products in inventory
    if (create_products) {
      for (const input of items as ReceiveItemInput[]) {
        const poItem = poItemMap.get(input.po_item_id) as Record<string, unknown> | undefined;
        if (!poItem || input.quantity_received <= 0) continue;

        for (let i = 0; i < input.quantity_received; i++) {
          await supabase.from('products').insert({
            product_type: poItem.product_type || 'accessory',
            brand: poItem.brand || 'N/A',
            model: poItem.model || (poItem.description as string),
            condition: 'new',
            purchase_price: poItem.unit_cost,
            selling_price: Math.round((poItem.unit_cost as number) * 1.3),
            status: 'in_stock',
            store_id: userStore,
            supplier_id: po.supplier_id,
            created_by: userId,
            notes: `Import depuis BC ${po.po_number}`,
          });
        }
      }
    }

    // Fetch final state
    const { data: finalPO } = await supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(*), items:po_items(*), creator:users(id, name)')
      .eq('id', id)
      .single();

    void journalWrite({
      event_type: 'purchase_order_received',
      entity_id: id,
      entity_type: 'purchase_order',
      user_id: userId,
      store_id: userStore,
      data: { purchase_order: finalPO, received_items: items },
    });

    return NextResponse.json(finalPO);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
