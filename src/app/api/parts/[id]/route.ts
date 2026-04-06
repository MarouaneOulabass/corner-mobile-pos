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
      .from('parts_inventory')
      .select('*, supplier:suppliers(*)')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Pièce introuvable' }, { status: 404 });
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

    // Get current part
    const { data: current, error: fetchError } = await supabase
      .from('parts_inventory')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Pièce introuvable' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'category', 'compatible_brands', 'compatible_models',
      'sku', 'quantity', 'min_quantity', 'purchase_price', 'selling_price',
      'supplier_id', 'bin_location', 'notes',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('parts_inventory')
      .update(updates)
      .eq('id', params.id)
      .select('*, supplier:suppliers(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Journal write
    journalWrite({
      event_type: 'part_updated',
      entity_id: params.id,
      entity_type: 'part',
      user_id: userId || 'system',
      store_id: current.store_id,
      data: { before: current, after: data, changes: updates },
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const userRole = request.headers.get('x-user-role');

    // Only manager+ can delete
    if (userRole === 'seller') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { error } = await supabase
      .from('parts_inventory')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
