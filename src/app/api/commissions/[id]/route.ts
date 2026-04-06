import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }
    if (userRole !== 'superadmin' && userRole !== 'manager') {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }

    const body = await request.json();
    const { status } = body;

    const validStatuses = ['pending', 'approved', 'paid', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { status };

    if (status === 'paid') {
      updates.paid_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('commissions')
      .update(updates)
      .eq('id', id)
      .select('*, user:users(id, name, role), rule:commission_rules(id, name, type, rate)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (status === 'paid') {
      void journalWrite({
        event_type: 'commission_paid',
        entity_id: id,
        entity_type: 'commission',
        user_id: userId,
        store_id: data.store_id,
        data: { commission: data },
      });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
