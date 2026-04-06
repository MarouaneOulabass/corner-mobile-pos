import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 });
    }

    const { data: card, error } = await supabase
      .from('gift_cards')
      .select('code, current_balance, status, expires_at')
      .eq('code', code.toUpperCase().trim())
      .single();

    if (error || !card) {
      return NextResponse.json({ error: 'Carte cadeau introuvable' }, { status: 404 });
    }

    // Check expiry
    if (card.status === 'active' && card.expires_at && new Date(card.expires_at) < new Date()) {
      // Auto-expire
      await supabase
        .from('gift_cards')
        .update({ status: 'expired' })
        .eq('code', code.toUpperCase().trim());

      return NextResponse.json({
        code: card.code,
        current_balance: card.current_balance,
        status: 'expired',
        expires_at: card.expires_at,
      });
    }

    return NextResponse.json({
      code: card.code,
      current_balance: card.current_balance,
      status: card.status,
      expires_at: card.expires_at,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
