import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const userId = request.headers.get('x-user-id');
    const userStore = request.headers.get('x-user-store');

    const { customer_id, points, sale_id } = body;

    if (!customer_id || !points || !sale_id) {
      return NextResponse.json(
        { error: 'customer_id, points et sale_id requis' },
        { status: 400 }
      );
    }

    if (points <= 0) {
      return NextResponse.json({ error: 'Points doit être positif' }, { status: 400 });
    }

    // Fetch customer
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id, loyalty_points')
      .eq('id', customer_id)
      .single();

    if (custErr || !customer) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }

    const currentPoints = customer.loyalty_points || 0;
    if (currentPoints < points) {
      return NextResponse.json(
        { error: `Points insuffisants. Solde actuel : ${currentPoints}` },
        { status: 400 }
      );
    }

    // Fetch loyalty settings for redemption rate
    const { data: settings } = await supabase
      .from('loyalty_settings')
      .select('redemption_rate')
      .eq('store_id', userStore!)
      .single();

    const redemptionRate = settings?.redemption_rate || 0.1;
    const discount_value = Math.round(points * redemptionRate * 100) / 100;
    const newBalance = currentPoints - points;

    // Deduct points
    const { error: updateErr } = await supabase
      .from('customers')
      .update({ loyalty_points: newBalance })
      .eq('id', customer_id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Create loyalty transaction
    const { data: tx, error: txErr } = await supabase
      .from('loyalty_transactions')
      .insert({
        customer_id,
        store_id: userStore,
        type: 'redeem',
        points: -points,
        balance_after: newBalance,
        reference_type: 'sale',
        reference_id: sale_id,
        description: `Utilisation de ${points} points (-${discount_value} MAD)`,
        created_by: userId,
      })
      .select()
      .single();

    if (txErr) {
      return NextResponse.json({ error: txErr.message }, { status: 500 });
    }

    // Journal write
    journalWrite({
      event_type: 'loyalty_redeemed',
      entity_id: tx.id,
      entity_type: 'loyalty',
      user_id: userId!,
      store_id: userStore || undefined,
      data: { customer_id, points, sale_id, discount_value, balance_after: newBalance },
    });

    return NextResponse.json({
      discount_value,
      new_balance: newBalance,
      transaction: tx,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
