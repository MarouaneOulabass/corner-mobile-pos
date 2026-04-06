import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('trade_ins')
      .select(
        '*, customer:customers(id, name, phone, email), processor:users!trade_ins_processed_by_fkey(id, name), product:products(id, brand, model, imei, selling_price, status)'
      )
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Rachat introuvable' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const userId = request.headers.get('x-user-id');
    const storeId = request.headers.get('x-user-store');

    if (!userId || !storeId) {
      return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 });
    }

    // --- GET CURRENT TRADE-IN ---
    const { data: current, error: fetchError } = await supabase
      .from('trade_ins')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Rachat introuvable' }, { status: 404 });
    }

    // --- VALIDATE STATUS TRANSITION ---
    const validTransitions: Record<string, string[]> = {
      pending: ['accepted', 'rejected'],
      accepted: ['in_refurbishment', 'listed'],
      rejected: [],
      in_refurbishment: ['listed'],
      listed: ['sold'],
      sold: [],
    };

    if (body.status && body.status !== current.status) {
      const allowed = validTransitions[current.status] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `Transition invalide: ${current.status} -> ${body.status}. Autorisées: ${allowed.join(', ') || 'aucune'}` },
          { status: 400 }
        );
      }
    }

    // --- BUILD UPDATE ---
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status) updates.status = body.status;
    if (body.offered_price != null) updates.offered_price = body.offered_price;
    if (body.notes !== undefined) updates.notes = body.notes;

    // --- SPECIAL HANDLING: ACCEPTED → Create product ---
    if (body.status === 'accepted' && current.status !== 'accepted') {
      const { data: newProduct, error: prodError } = await supabase
        .from('products')
        .insert({
          product_type: 'phone',
          brand: current.device_brand,
          model: current.device_model,
          imei: current.imei || null,
          storage: current.storage || null,
          color: current.color || null,
          condition: current.condition,
          purchase_price: current.offered_price,
          selling_price: body.selling_price || Math.round(current.offered_price * 1.3), // Default 30% margin
          status: 'in_stock',
          store_id: storeId,
          supplier: 'Rachat client',
          created_by: userId,
          purchase_date: new Date().toISOString(),
          notes: `Rachat #${params.id}`,
        })
        .select('id')
        .single();

      if (prodError) {
        return NextResponse.json({ error: 'Erreur création produit: ' + prodError.message }, { status: 500 });
      }

      updates.product_id = newProduct.id;

      void journalWrite({
        event_type: 'trade_in_accepted',
        entity_id: params.id,
        entity_type: 'trade_in',
        user_id: userId,
        store_id: storeId,
        data: { trade_in_id: params.id, product_id: newProduct.id, offered_price: current.offered_price },
      });
    }

    // --- SPECIAL HANDLING: REJECTED ---
    if (body.status === 'rejected' && current.status !== 'rejected') {
      void journalWrite({
        event_type: 'trade_in_rejected',
        entity_id: params.id,
        entity_type: 'trade_in',
        user_id: userId,
        store_id: storeId,
        data: { trade_in_id: params.id, reason: body.notes || '' },
      });
    }

    // --- OTHER STATUS CHANGES ---
    if (body.status && body.status !== 'accepted' && body.status !== 'rejected' && body.status !== current.status) {
      void journalWrite({
        event_type: 'trade_in_status_changed',
        entity_id: params.id,
        entity_type: 'trade_in',
        user_id: userId,
        store_id: storeId,
        data: { old_status: current.status, new_status: body.status },
      });
    }

    // --- UPDATE ---
    const { data, error } = await supabase
      .from('trade_ins')
      .update(updates)
      .eq('id', params.id)
      .select('*, customer:customers(id, name, phone), processor:users!trade_ins_processed_by_fkey(id, name), product:products(id, brand, model, imei, selling_price, status)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
