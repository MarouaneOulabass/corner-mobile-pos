import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    let query = supabase
      .from('commission_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ rules: data || [] });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userId = request.headers.get('x-user-id');
    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    if (!userId || !userStore) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }
    if (userRole !== 'superadmin' && userRole !== 'manager') {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }

    const body = await request.json();
    const { name, type, rate, min_amount, applies_to, active } = body;

    if (!name || !type || rate == null) {
      return NextResponse.json({ error: 'Champs requis: name, type, rate' }, { status: 400 });
    }

    const validTypes = ['sale_percentage', 'sale_flat', 'repair_percentage', 'repair_flat'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
    }

    if (rate < 0) {
      return NextResponse.json({ error: 'Le taux doit etre >= 0' }, { status: 400 });
    }

    const validAppliesTo = ['all', 'seller', 'manager'];
    if (applies_to && !validAppliesTo.includes(applies_to)) {
      return NextResponse.json({ error: 'applies_to invalide' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('commission_rules')
      .insert({
        store_id: userStore,
        name,
        type,
        rate,
        min_amount: min_amount || 0,
        applies_to: applies_to || 'all',
        active: active !== false,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userRole = request.headers.get('x-user-role');

    if (userRole !== 'superadmin' && userRole !== 'manager') {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const allowedFields = ['name', 'type', 'rate', 'min_amount', 'applies_to', 'active'];
    const filtered: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) filtered[key] = updates[key];
    }

    const { data, error } = await supabase
      .from('commission_rules')
      .update(filtered)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userRole = request.headers.get('x-user-role');

    if (userRole !== 'superadmin' && userRole !== 'manager') {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const { error } = await supabase
      .from('commission_rules')
      .delete()
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
