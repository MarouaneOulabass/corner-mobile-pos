import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');

    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');
    const store_id = searchParams.get('store_id');

    let query = supabase
      .from('cash_sessions')
      .select(
        '*, opener:users!cash_sessions_opened_by_fkey(id, name, role, email), closer:users!cash_sessions_closed_by_fkey(id, name, role, email)',
        { count: 'exact' }
      );

    // Store scoping
    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    } else if (store_id) {
      query = query.eq('store_id', store_id);
    }

    if (status) query = query.eq('status', status);
    if (date_from) query = query.gte('opened_at', date_from);
    if (date_to) query = query.lte('opened_at', date_to + 'T23:59:59');

    query = query.order('opened_at', { ascending: false });

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ sessions: data || [], total: count || 0 });
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
      return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
    }

    // Validate required fields
    if (body.opening_amount == null || body.opening_amount < 0) {
      return NextResponse.json({ error: 'Montant d\'ouverture requis et doit etre >= 0' }, { status: 400 });
    }

    // Check no other open session for this store
    const { data: openSessions } = await supabase
      .from('cash_sessions')
      .select('id')
      .eq('store_id', storeId)
      .eq('status', 'open')
      .limit(1);

    if (openSessions && openSessions.length > 0) {
      return NextResponse.json({ error: 'Une session de caisse est deja ouverte pour ce magasin' }, { status: 409 });
    }

    const { data: session, error } = await supabase
      .from('cash_sessions')
      .insert({
        store_id: storeId,
        opened_by: userId,
        opening_amount: body.opening_amount,
        status: 'open',
        notes: body.notes || null,
        opened_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void journalWrite({
      event_type: 'cash_session_opened',
      entity_id: session.id,
      entity_type: 'cash_session',
      user_id: userId,
      store_id: storeId,
      data: session,
    });

    return NextResponse.json(session, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
