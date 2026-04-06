import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: card, error } = await supabase
      .from('gift_cards')
      .select('*, customer:customers(id, name, phone)')
      .eq('id', id)
      .single();

    if (error || !card) {
      return NextResponse.json({ error: 'Carte cadeau introuvable' }, { status: 404 });
    }

    // Fetch transactions
    const { data: transactions } = await supabase
      .from('gift_card_transactions')
      .select('*, user:users(id, name)')
      .eq('gift_card_id', id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ ...card, transactions: transactions || [] });
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

    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
    }

    const validStatuses = ['cancelled'];
    if (!body.status || !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Statut invalide. Valeur acceptee: cancelled' }, { status: 400 });
    }

    const { data: card, error: fetchErr } = await supabase
      .from('gift_cards')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchErr || !card) {
      return NextResponse.json({ error: 'Carte cadeau introuvable' }, { status: 404 });
    }

    if (card.status === 'used') {
      return NextResponse.json({ error: 'Impossible d\'annuler une carte deja utilisee' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('gift_cards')
      .update({ status: body.status })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
