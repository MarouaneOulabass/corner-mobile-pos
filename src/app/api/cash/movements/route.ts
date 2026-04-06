import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const session_id = searchParams.get('session_id');

    if (!session_id) {
      return NextResponse.json({ error: 'session_id requis' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('cash_movements')
      .select('*, user:users(id, name, role, email)')
      .eq('session_id', session_id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ movements: data || [] });
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
    if (!body.session_id) {
      return NextResponse.json({ error: 'session_id requis' }, { status: 400 });
    }

    const validTypes = ['expense', 'deposit', 'withdrawal', 'adjustment'];
    if (!body.type || !validTypes.includes(body.type)) {
      return NextResponse.json({ error: 'Type invalide. Valeurs acceptees: expense, deposit, withdrawal, adjustment' }, { status: 400 });
    }

    if (body.amount == null || body.amount <= 0) {
      return NextResponse.json({ error: 'Montant requis et doit etre > 0' }, { status: 400 });
    }

    if (!body.reason || body.reason.trim().length === 0) {
      return NextResponse.json({ error: 'Raison requise' }, { status: 400 });
    }

    // Validate session is open
    const { data: session, error: sessionErr } = await supabase
      .from('cash_sessions')
      .select('id, status, store_id')
      .eq('id', body.session_id)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });
    }

    if (session.status !== 'open') {
      return NextResponse.json({ error: 'La session est fermee, impossible d\'ajouter un mouvement' }, { status: 400 });
    }

    const { data: movement, error } = await supabase
      .from('cash_movements')
      .insert({
        session_id: body.session_id,
        store_id: session.store_id,
        user_id: userId,
        type: body.type,
        amount: body.amount,
        reason: body.reason.trim(),
        reference_id: body.reference_id || null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void journalWrite({
      event_type: 'cash_movement_created',
      entity_id: movement.id,
      entity_type: 'cash_movement',
      user_id: userId,
      store_id: session.store_id,
      data: movement,
    });

    return NextResponse.json(movement, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
