import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    const user_id = searchParams.get('user_id');
    const status = searchParams.get('status');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');

    let query = supabase
      .from('commissions')
      .select('*, user:users(id, name, role), rule:commission_rules(id, name, type, rate)')
      .order('created_at', { ascending: false });

    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    }

    if (user_id) query = query.eq('user_id', user_id);
    if (status) query = query.eq('status', status);
    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to + 'T23:59:59');

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ commissions: data || [] });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const callerId = request.headers.get('x-user-id');
    const callerStore = request.headers.get('x-user-store');

    if (!callerId || !callerStore) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const body = await request.json();
    const { user_id, type, reference_id, base_amount } = body;

    if (!user_id || !type || !reference_id || base_amount == null) {
      return NextResponse.json(
        { error: 'Champs requis: user_id, type, reference_id, base_amount' },
        { status: 400 }
      );
    }

    if (!['sale', 'repair'].includes(type)) {
      return NextResponse.json({ error: 'Type invalide (sale ou repair)' }, { status: 400 });
    }

    // Get user role to match rules
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, role, store_id')
      .eq('id', user_id)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    // Find matching active rules
    const ruleType = type === 'sale' ? ['sale_percentage', 'sale_flat'] : ['repair_percentage', 'repair_flat'];

    const { data: rules, error: rulesError } = await supabase
      .from('commission_rules')
      .select('*')
      .eq('store_id', targetUser.store_id)
      .eq('active', true)
      .in('type', ruleType);

    if (rulesError) return NextResponse.json({ error: rulesError.message }, { status: 500 });

    if (!rules || rules.length === 0) {
      return NextResponse.json({ error: 'Aucune regle de commission active' }, { status: 404 });
    }

    // Filter rules that apply to this user role
    const applicableRules = rules.filter(
      (r) => r.applies_to === 'all' || r.applies_to === targetUser.role
    );

    if (applicableRules.length === 0) {
      return NextResponse.json({ error: 'Aucune regle applicable' }, { status: 404 });
    }

    // Filter by min_amount
    const matchingRules = applicableRules.filter((r) => base_amount >= r.min_amount);

    if (matchingRules.length === 0) {
      return NextResponse.json({ error: 'Montant insuffisant pour les regles actives' }, { status: 400 });
    }

    // Calculate commission for each matching rule and create records
    const created: unknown[] = [];

    for (const rule of matchingRules) {
      let commissionAmount = 0;
      if (rule.type.endsWith('_percentage')) {
        commissionAmount = Math.round((base_amount * rule.rate) / 100 * 100) / 100;
      } else {
        commissionAmount = rule.rate;
      }

      if (commissionAmount <= 0) continue;

      const { data: commission, error: cError } = await supabase
        .from('commissions')
        .insert({
          user_id,
          store_id: targetUser.store_id,
          rule_id: rule.id,
          type,
          reference_id,
          base_amount,
          commission_amount: commissionAmount,
          status: 'pending',
        })
        .select('*')
        .single();

      if (cError) continue;

      created.push(commission);

      void journalWrite({
        event_type: 'commission_created',
        entity_id: commission.id,
        entity_type: 'commission',
        user_id: callerId,
        store_id: targetUser.store_id,
        data: { commission, rule_id: rule.id, base_amount, commission_amount: commissionAmount },
      });
    }

    return NextResponse.json({ commissions: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
