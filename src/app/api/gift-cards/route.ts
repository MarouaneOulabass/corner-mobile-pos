import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';
import { generateGiftCardCode } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');
    const store_id = searchParams.get('store_id');

    let query = supabase
      .from('gift_cards')
      .select(
        '*, customer:customers(id, name, phone)',
        { count: 'exact' }
      );

    // Store scoping
    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    } else if (store_id) {
      query = query.eq('store_id', store_id);
    }

    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('code', `%${search}%`);

    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ gift_cards: data || [], total: count || 0 });
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

    // Validate
    if (body.initial_amount == null || body.initial_amount <= 0) {
      return NextResponse.json({ error: 'Montant initial requis et doit etre > 0' }, { status: 400 });
    }

    // Generate unique code with retry
    let code = generateGiftCardCode();
    let retries = 0;
    while (retries < 5) {
      const { data: existing } = await supabase
        .from('gift_cards')
        .select('id')
        .eq('code', code)
        .maybeSingle();

      if (!existing) break;
      code = generateGiftCardCode();
      retries++;
    }

    if (retries >= 5) {
      return NextResponse.json({ error: 'Impossible de generer un code unique' }, { status: 500 });
    }

    const { data: card, error } = await supabase
      .from('gift_cards')
      .insert({
        code,
        initial_amount: body.initial_amount,
        current_balance: body.initial_amount,
        customer_id: body.customer_id || null,
        store_id: storeId,
        created_by: userId,
        status: 'active',
        expires_at: body.expires_at || null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Create purchase transaction
    await supabase.from('gift_card_transactions').insert({
      gift_card_id: card.id,
      type: 'purchase',
      amount: body.initial_amount,
      user_id: userId,
    });

    void journalWrite({
      event_type: 'gift_card_created',
      entity_id: card.id,
      entity_type: 'gift_card',
      user_id: userId,
      store_id: storeId,
      data: card,
    });

    return NextResponse.json(card, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
