import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';
import { LoyaltyTier } from '@/types';

function calculateTier(
  totalPointsEarned: number,
  thresholds: { bronze: number; silver: number; gold: number; platinum: number }
): LoyaltyTier {
  if (totalPointsEarned >= thresholds.platinum) return 'platinum';
  if (totalPointsEarned >= thresholds.gold) return 'gold';
  if (totalPointsEarned >= thresholds.silver) return 'silver';
  return 'bronze';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const customer_id = searchParams.get('customer_id');

    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id requis' }, { status: 400 });
    }

    // Fetch customer
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id, name, phone, loyalty_tier, loyalty_points')
      .eq('id', customer_id)
      .single();

    if (custErr || !customer) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }

    // Fetch recent loyalty transactions
    const { data: transactions } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_id', customer_id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Calculate total earned (for tier calculation)
    const { data: earnedData } = await supabase
      .from('loyalty_transactions')
      .select('points')
      .eq('customer_id', customer_id)
      .in('type', ['earn', 'bonus']);

    const totalEarned = (earnedData || []).reduce((sum, t) => sum + t.points, 0);

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        tier: customer.loyalty_tier || 'bronze',
        points: customer.loyalty_points || 0,
        total_earned: totalEarned,
      },
      transactions: transactions || [],
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const userId = request.headers.get('x-user-id');
    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    if (!userRole || !['superadmin', 'manager'].includes(userRole)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { customer_id, type, points, description } = body;

    if (!customer_id || !type || points === undefined || !description) {
      return NextResponse.json(
        { error: 'customer_id, type, points et description requis' },
        { status: 400 }
      );
    }

    if (!['bonus', 'adjustment'].includes(type)) {
      return NextResponse.json({ error: 'Type doit être bonus ou adjustment' }, { status: 400 });
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
    const newPoints = currentPoints + points;

    if (newPoints < 0) {
      return NextResponse.json(
        { error: 'Points insuffisants pour cet ajustement' },
        { status: 400 }
      );
    }

    // Update customer points
    const { error: updateErr } = await supabase
      .from('customers')
      .update({ loyalty_points: newPoints })
      .eq('id', customer_id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Recalculate tier
    const { data: earnedData } = await supabase
      .from('loyalty_transactions')
      .select('points')
      .eq('customer_id', customer_id)
      .in('type', ['earn', 'bonus']);

    let totalEarned = (earnedData || []).reduce((sum, t) => sum + t.points, 0);
    if (type === 'bonus') totalEarned += points;

    // Fetch loyalty settings for tier thresholds
    const { data: settings } = await supabase
      .from('loyalty_settings')
      .select('*')
      .eq('store_id', userStore!)
      .single();

    const thresholds = {
      bronze: settings?.bronze_threshold || 0,
      silver: settings?.silver_threshold || 500,
      gold: settings?.gold_threshold || 2000,
      platinum: settings?.platinum_threshold || 5000,
    };

    const newTier = calculateTier(totalEarned, thresholds);

    await supabase
      .from('customers')
      .update({ loyalty_tier: newTier })
      .eq('id', customer_id);

    // Create loyalty transaction
    const { data: tx, error: txErr } = await supabase
      .from('loyalty_transactions')
      .insert({
        customer_id,
        store_id: userStore,
        type,
        points,
        balance_after: newPoints,
        description,
        created_by: userId,
      })
      .select()
      .single();

    if (txErr) {
      return NextResponse.json({ error: txErr.message }, { status: 500 });
    }

    // Journal write
    journalWrite({
      event_type: 'loyalty_adjusted',
      entity_id: tx.id,
      entity_type: 'loyalty',
      user_id: userId!,
      store_id: userStore || undefined,
      data: { customer_id, type, points, description, balance_after: newPoints, tier: newTier },
    });

    return NextResponse.json({
      transaction: tx,
      new_balance: newPoints,
      new_tier: newTier,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
