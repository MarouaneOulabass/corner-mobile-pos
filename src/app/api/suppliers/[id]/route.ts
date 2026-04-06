import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !supplier) {
      return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 });
    }

    // Get purchase order history
    const { data: orders } = await supabase
      .from('purchase_orders')
      .select('*, items:po_items(*), creator:users(id, name)')
      .eq('supplier_id', id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      supplier,
      purchase_orders: orders || [],
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const userId = request.headers.get('x-user-id');
    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    if (!userId) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }
    if (userRole !== 'superadmin' && userRole !== 'manager') {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }

    const body = await request.json();
    const allowedFields = ['name', 'contact_name', 'phone', 'email', 'address', 'notes'];
    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Rien a mettre a jour' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void journalWrite({
      event_type: 'supplier_updated',
      entity_id: id,
      entity_type: 'supplier',
      user_id: userId,
      store_id: userStore || undefined,
      data: { updates },
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const userRole = request.headers.get('x-user-role');

    if (userRole !== 'superadmin' && userRole !== 'manager') {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }

    // Check for existing POs
    const { data: pos } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('supplier_id', id)
      .limit(1);

    if (pos && pos.length > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer un fournisseur avec des bons de commande existants' },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
