import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const userId = request.headers.get('x-user-id');
    const storeId = request.headers.get('x-user-store');

    if (!userId || !storeId) {
      return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
    }

    // Validate
    if (!body.code) {
      return NextResponse.json({ error: 'Code carte cadeau requis' }, { status: 400 });
    }
    if (body.amount == null || body.amount <= 0) {
      return NextResponse.json({ error: 'Montant requis et doit etre > 0' }, { status: 400 });
    }
    if (!body.sale_id) {
      return NextResponse.json({ error: 'sale_id requis' }, { status: 400 });
    }

    // Find card by code
    const { data: card, error: cardErr } = await supabase
      .from('gift_cards')
      .select('*')
      .eq('code', body.code.toUpperCase().trim())
      .single();

    if (cardErr || !card) {
      return NextResponse.json({ error: 'Carte cadeau introuvable' }, { status: 404 });
    }

    if (card.status !== 'active') {
      return NextResponse.json({ error: `Carte cadeau non utilisable (statut: ${card.status})` }, { status: 400 });
    }

    // Check expiry
    if (card.expires_at && new Date(card.expires_at) < new Date()) {
      // Auto-expire
      await supabase.from('gift_cards').update({ status: 'expired' }).eq('id', card.id);
      return NextResponse.json({ error: 'Carte cadeau expiree' }, { status: 400 });
    }

    if (body.amount > card.current_balance + 0.01) {
      return NextResponse.json({ error: `Solde insuffisant. Solde disponible: ${card.current_balance} MAD` }, { status: 400 });
    }

    // Deduct balance
    const newBalance = Math.round((card.current_balance - body.amount) * 100) / 100;
    const newStatus = newBalance <= 0 ? 'used' : 'active';

    const { error: updateErr } = await supabase
      .from('gift_cards')
      .update({ current_balance: Math.max(0, newBalance), status: newStatus })
      .eq('id', card.id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // Create transaction
    const { data: tx, error: txErr } = await supabase
      .from('gift_card_transactions')
      .insert({
        gift_card_id: card.id,
        type: 'redemption',
        amount: body.amount,
        sale_id: body.sale_id,
        user_id: userId,
      })
      .select('*')
      .single();

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    void journalWrite({
      event_type: 'gift_card_redeemed',
      entity_id: card.id,
      entity_type: 'gift_card',
      user_id: userId,
      store_id: storeId,
      data: { transaction: tx, remaining_balance: Math.max(0, newBalance), sale_id: body.sale_id },
    });

    return NextResponse.json({
      success: true,
      remaining_balance: Math.max(0, newBalance),
      status: newStatus,
      transaction_id: tx.id,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
