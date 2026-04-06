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
      .from('repair_parts_used')
      .select('*, part:parts_inventory(id, name, category, sku, bin_location)')
      .eq('repair_id', params.id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ parts: data || [] });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const userId = request.headers.get('x-user-id');
    const userStore = request.headers.get('x-user-store');

    // Validate required fields
    const required = ['part_id', 'quantity', 'unit_cost'];
    const missing = required.filter((f) => body[f] === undefined || body[f] === null);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Champs requis manquants: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    if (typeof body.quantity !== 'number' || body.quantity < 1) {
      return NextResponse.json({ error: 'Quantité invalide (minimum 1)' }, { status: 400 });
    }

    if (typeof body.unit_cost !== 'number' || body.unit_cost < 0) {
      return NextResponse.json({ error: 'Coût unitaire invalide' }, { status: 400 });
    }

    // Check repair exists
    const { data: repair, error: repairError } = await supabase
      .from('repairs')
      .select('id, store_id')
      .eq('id', params.id)
      .single();

    if (repairError || !repair) {
      return NextResponse.json({ error: 'Réparation introuvable' }, { status: 404 });
    }

    // Check part exists and has enough stock
    const { data: part, error: partError } = await supabase
      .from('parts_inventory')
      .select('id, name, quantity, store_id')
      .eq('id', body.part_id)
      .single();

    if (partError || !part) {
      return NextResponse.json({ error: 'Pièce introuvable' }, { status: 404 });
    }

    if (part.quantity < body.quantity) {
      return NextResponse.json(
        { error: `Stock insuffisant: ${part.quantity} disponible(s), ${body.quantity} demandé(s)` },
        { status: 400 }
      );
    }

    // Decrement part quantity
    const { error: decrementError } = await supabase
      .from('parts_inventory')
      .update({ quantity: part.quantity - body.quantity, updated_at: new Date().toISOString() })
      .eq('id', body.part_id);

    if (decrementError) {
      return NextResponse.json({ error: 'Erreur lors de la mise à jour du stock' }, { status: 500 });
    }

    // Create repair_parts_used record
    const { data, error } = await supabase
      .from('repair_parts_used')
      .insert({
        repair_id: params.id,
        part_id: body.part_id,
        quantity: body.quantity,
        unit_cost: body.unit_cost,
      })
      .select('*, part:parts_inventory(id, name, category, sku, bin_location)')
      .single();

    if (error) {
      // Attempt to rollback the quantity decrement
      await supabase
        .from('parts_inventory')
        .update({ quantity: part.quantity, updated_at: new Date().toISOString() })
        .eq('id', body.part_id);

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Journal write
    journalWrite({
      event_type: 'part_used_in_repair',
      entity_id: data.id,
      entity_type: 'part',
      user_id: userId || 'system',
      store_id: userStore || repair.store_id,
      data: {
        repair_id: params.id,
        part_id: body.part_id,
        part_name: part.name,
        quantity: body.quantity,
        unit_cost: body.unit_cost,
        remaining_stock: part.quantity - body.quantity,
      },
    });

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
