import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userRole = request.headers.get('x-user-role');
    const userStore = request.headers.get('x-user-store');

    if (userRole === 'superadmin') {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ stores: data || [] });
    }

    // Non-superadmin: return only their own store
    if (!userStore) {
      return NextResponse.json({ error: 'Magasin non assigné' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', userStore);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ stores: data || [] });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (userRole !== 'superadmin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const supabase = createServiceClient();
    const body = await request.json();

    const { name, location } = body;
    if (!name || !location) {
      return NextResponse.json(
        { error: 'Le nom et la localisation sont requis' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('stores')
      .insert({ name, location })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    journalWrite({
      event_type: 'store_created',
      entity_id: data.id,
      entity_type: 'store',
      user_id: userId || 'unknown',
      data: { name, location },
    });

    return NextResponse.json({ store: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
