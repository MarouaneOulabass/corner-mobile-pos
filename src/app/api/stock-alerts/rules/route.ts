import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { AlertType, ProductType } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    let query = supabase
      .from('stock_alert_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rules: data || [] });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    const userStore = request.headers.get('x-user-store');

    // Only manager+ can create rules
    if (userRole === 'seller') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Validate required fields
    const required = ['name', 'alert_type', 'threshold'];
    const missing = required.filter((f) => !body[f] && body[f] !== 0);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Champs requis manquants: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate alert_type
    const validTypes: AlertType[] = ['low_stock', 'aging_stock', 'negative_margin', 'warranty_expiring'];
    if (!validTypes.includes(body.alert_type)) {
      return NextResponse.json({ error: 'Type d\'alerte invalide' }, { status: 400 });
    }

    // Validate product_type if provided
    if (body.product_type) {
      const validProductTypes: ProductType[] = ['phone', 'accessory', 'part'];
      if (!validProductTypes.includes(body.product_type)) {
        return NextResponse.json({ error: 'Type de produit invalide' }, { status: 400 });
      }
    }

    if (typeof body.threshold !== 'number' || body.threshold < 0) {
      return NextResponse.json({ error: 'Seuil invalide' }, { status: 400 });
    }

    const storeId = body.store_id || userStore;

    const { data, error } = await supabase
      .from('stock_alert_rules')
      .insert({
        store_id: storeId,
        name: body.name,
        alert_type: body.alert_type,
        product_type: body.product_type || null,
        brand: body.brand || null,
        threshold: body.threshold,
        enabled: body.enabled !== false,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const userRole = request.headers.get('x-user-role');

    if (userRole === 'seller') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.alert_type !== undefined) updates.alert_type = body.alert_type;
    if (body.product_type !== undefined) updates.product_type = body.product_type;
    if (body.brand !== undefined) updates.brand = body.brand;
    if (body.threshold !== undefined) updates.threshold = body.threshold;
    if (body.enabled !== undefined) updates.enabled = body.enabled;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('stock_alert_rules')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userRole = request.headers.get('x-user-role');

    if (userRole === 'seller') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const { error } = await supabase
      .from('stock_alert_rules')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
