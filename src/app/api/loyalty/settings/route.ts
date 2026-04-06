import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

const DEFAULT_SETTINGS = {
  points_per_mad: 1,
  redemption_rate: 0.1,
  bronze_threshold: 0,
  silver_threshold: 500,
  gold_threshold: 2000,
  platinum_threshold: 5000,
  enabled: false,
};

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');
    const store_id = searchParams.get('store_id') || userStore;

    if (!store_id) {
      return NextResponse.json({ error: 'store_id requis' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('loyalty_settings')
      .select('*')
      .eq('store_id', store_id)
      .single();

    if (error || !data) {
      // Return defaults if no settings exist
      return NextResponse.json({
        settings: { ...DEFAULT_SETTINGS, store_id, id: null },
      });
    }

    return NextResponse.json({ settings: data });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');
    const userStore = request.headers.get('x-user-store');

    if (!userRole || !['superadmin', 'manager'].includes(userRole)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const store_id = body.store_id || userStore;
    if (!store_id) {
      return NextResponse.json({ error: 'store_id requis' }, { status: 400 });
    }

    if (userRole !== 'superadmin' && store_id !== userStore) {
      return NextResponse.json({ error: 'Accès refusé à ce magasin' }, { status: 403 });
    }

    const updateData = {
      store_id,
      points_per_mad: body.points_per_mad ?? DEFAULT_SETTINGS.points_per_mad,
      redemption_rate: body.redemption_rate ?? DEFAULT_SETTINGS.redemption_rate,
      bronze_threshold: body.bronze_threshold ?? DEFAULT_SETTINGS.bronze_threshold,
      silver_threshold: body.silver_threshold ?? DEFAULT_SETTINGS.silver_threshold,
      gold_threshold: body.gold_threshold ?? DEFAULT_SETTINGS.gold_threshold,
      platinum_threshold: body.platinum_threshold ?? DEFAULT_SETTINGS.platinum_threshold,
      enabled: body.enabled ?? DEFAULT_SETTINGS.enabled,
      updated_at: new Date().toISOString(),
    };

    // Check if settings exist
    const { data: existing } = await supabase
      .from('loyalty_settings')
      .select('id')
      .eq('store_id', store_id)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from('loyalty_settings')
        .update(updateData)
        .eq('store_id', store_id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('loyalty_settings')
        .insert(updateData)
        .select()
        .single();
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: result.data });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
