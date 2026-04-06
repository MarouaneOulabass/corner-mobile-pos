import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(*), items:po_items(*), creator:users(id, name)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Bon de commande introuvable' }, { status: 404 });
    }

    return NextResponse.json(data);
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
    const userRole = request.headers.get('x-user-role');

    if (userRole !== 'superadmin' && userRole !== 'manager') {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }

    const body = await request.json();
    const { status, notes } = body;

    // Fetch current PO
    const { data: current, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Bon de commande introuvable' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (status) {
      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        draft: ['sent', 'cancelled'],
        sent: ['partial', 'received', 'cancelled'],
        partial: ['received', 'cancelled'],
        received: [],
        cancelled: [],
      };

      const allowed = validTransitions[current.status] || [];
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Transition invalide: ${current.status} → ${status}` },
          { status: 400 }
        );
      }

      updates.status = status;

      if (status === 'received') {
        updates.received_at = new Date().toISOString();
      }
    }

    if (notes !== undefined) {
      updates.notes = notes;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Rien a mettre a jour' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .update(updates)
      .eq('id', id)
      .select('*, supplier:suppliers(*), items:po_items(*), creator:users(id, name)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
