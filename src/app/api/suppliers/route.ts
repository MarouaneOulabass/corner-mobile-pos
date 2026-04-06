import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    const search = searchParams.get('search');

    let query = supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    // Store scoping: superadmin sees all, others see their store's + global (null store_id)
    if (userRole !== 'superadmin' && userStore) {
      query = query.or(`store_id.eq.${userStore},store_id.is.null`);
    }

    if (search) {
      const sanitized = search.replace(/[^a-zA-Z0-9\s\-àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/g, '');
      query = query.ilike('name', `%${sanitized}%`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ suppliers: data || [] });
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
    const { name, contact_name, phone, email, address, notes } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        name: name.trim(),
        contact_name: contact_name || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
        store_id: userRole === 'superadmin' ? null : userStore,
        created_by: userId,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void journalWrite({
      event_type: 'supplier_created',
      entity_id: data.id,
      entity_type: 'supplier',
      user_id: userId,
      store_id: userStore,
      data: { supplier: data },
    });

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
