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

    const { data: session, error } = await supabase
      .from('cash_sessions')
      .select(
        '*, opener:users!cash_sessions_opened_by_fkey(id, name, role, email), closer:users!cash_sessions_closed_by_fkey(id, name, role, email)'
      )
      .eq('id', id)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });
    }

    // Fetch movements for this session
    const { data: movements } = await supabase
      .from('cash_movements')
      .select('*, user:users(id, name, role, email)')
      .eq('session_id', id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ ...session, movements: movements || [] });
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
    const body = await request.json();

    const userId = request.headers.get('x-user-id');
    const storeId = request.headers.get('x-user-store');

    if (!userId || !storeId) {
      return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
    }

    // Fetch existing session
    const { data: session, error: fetchErr } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });
    }

    if (session.status === 'closed') {
      return NextResponse.json({ error: 'Cette session est deja fermee' }, { status: 400 });
    }

    if (body.closing_amount == null || body.closing_amount < 0) {
      return NextResponse.json({ error: 'Montant de fermeture requis' }, { status: 400 });
    }

    // Calculate expected amount
    // opening + sales cash - returns cash + deposits - withdrawals + adjustments - expenses
    const { data: movements } = await supabase
      .from('cash_movements')
      .select('type, amount')
      .eq('session_id', id);

    let movementTotal = 0;
    if (movements) {
      for (const m of movements) {
        switch (m.type) {
          case 'sale':
          case 'deposit':
            movementTotal += m.amount;
            break;
          case 'return':
          case 'expense':
          case 'withdrawal':
            movementTotal -= m.amount;
            break;
          case 'adjustment':
            movementTotal += m.amount; // Can be positive or negative
            break;
        }
      }
    }

    const expectedAmount = Math.round((session.opening_amount + movementTotal) * 100) / 100;
    const difference = Math.round((body.closing_amount - expectedAmount) * 100) / 100;

    const { data: updated, error } = await supabase
      .from('cash_sessions')
      .update({
        closing_amount: body.closing_amount,
        expected_amount: expectedAmount,
        difference,
        status: 'closed',
        closed_by: userId,
        closed_at: new Date().toISOString(),
        notes: body.notes || session.notes,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void journalWrite({
      event_type: 'cash_session_closed',
      entity_id: id,
      entity_type: 'cash_session',
      user_id: userId,
      store_id: storeId,
      data: { ...updated, expected_amount: expectedAmount, difference },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
