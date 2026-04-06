import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search');

    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    let query = supabase
      .from('trade_ins')
      .select(
        '*, customer:customers(id, name, phone), processor:users!trade_ins_processed_by_fkey(id, name)',
        { count: 'exact' }
      );

    // Store scoping
    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    }

    if (status) query = query.eq('status', status);

    if (search) {
      const sanitized = search.replace(/[^a-zA-Z0-9\s]/g, '');
      query = query.or(`device_brand.ilike.%${sanitized}%,device_model.ilike.%${sanitized}%,imei.ilike.%${sanitized}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ trade_ins: data || [], total: count || 0 });
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
      return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 });
    }

    // --- VALIDATION ---
    const { device_brand, device_model, condition, offered_price } = body;

    if (!device_brand || device_brand.trim().length === 0) {
      return NextResponse.json({ error: 'Marque de l\'appareil requise' }, { status: 400 });
    }
    if (!device_model || device_model.trim().length === 0) {
      return NextResponse.json({ error: 'Modèle de l\'appareil requis' }, { status: 400 });
    }

    const validConditions = ['new', 'like_new', 'good', 'fair', 'poor'];
    if (!condition || !validConditions.includes(condition)) {
      return NextResponse.json({ error: 'État invalide' }, { status: 400 });
    }

    if (offered_price == null || offered_price < 0) {
      return NextResponse.json({ error: 'Prix proposé invalide' }, { status: 400 });
    }

    // --- HANDLE CUSTOMER ---
    let customerId = body.customer_id || null;
    if (!customerId && body.customer_phone) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', body.customer_phone)
        .maybeSingle();

      if (existing) {
        customerId = existing.id;
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({
            name: body.customer_name || 'Client',
            phone: body.customer_phone,
            whatsapp: body.customer_phone,
          })
          .select('id')
          .single();
        if (custErr) {
          return NextResponse.json({ error: 'Erreur création client: ' + custErr.message }, { status: 500 });
        }
        customerId = newCust.id;
      }
    }

    // --- CREATE TRADE-IN ---
    const { data: tradeIn, error: tradeInError } = await supabase
      .from('trade_ins')
      .insert({
        customer_id: customerId,
        store_id: storeId,
        processed_by: userId,
        device_brand: device_brand.trim(),
        device_model: device_model.trim(),
        imei: body.imei || null,
        storage: body.storage || null,
        color: body.color || null,
        condition,
        offered_price,
        ai_suggested_price: body.ai_suggested_price || null,
        status: 'pending',
        notes: body.notes || null,
      })
      .select('*')
      .single();

    if (tradeInError) {
      return NextResponse.json({ error: 'Erreur création rachat: ' + tradeInError.message }, { status: 500 });
    }

    // --- JOURNAL ---
    void journalWrite({
      event_type: 'trade_in_created',
      entity_id: tradeIn.id,
      entity_type: 'trade_in',
      user_id: userId,
      store_id: storeId,
      data: tradeIn,
    });

    // --- FETCH COMPLETE ---
    const { data: complete } = await supabase
      .from('trade_ins')
      .select('*, customer:customers(id, name, phone), processor:users!trade_ins_processed_by_fkey(id, name)')
      .eq('id', tradeIn.id)
      .single();

    return NextResponse.json(complete || tradeIn, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
