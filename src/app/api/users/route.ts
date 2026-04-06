import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';
import bcrypt from 'bcryptjs';

const VALID_ROLES = ['superadmin', 'manager', 'seller'];

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userRole = request.headers.get('x-user-role');
    const userStore = request.headers.get('x-user-store');

    if (userRole === 'seller') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    let query = supabase
      .from('users')
      .select('id, email, name, role, store_id, created_at, store:stores(id, name, location)')
      .order('created_at', { ascending: false });

    // Manager: only their store's users
    if (userRole === 'manager' && userStore) {
      query = query.eq('store_id', userStore);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data || [] });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');
    const userStore = request.headers.get('x-user-store');

    if (userRole !== 'superadmin' && userRole !== 'manager') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const supabase = createServiceClient();
    const body = await request.json();
    const { email, name, password, role, store_id } = body;

    // Validate required fields
    if (!email || !name || !password || !role || !store_id) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis : email, nom, mot de passe, rôle, magasin' },
        { status: 400 }
      );
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Rôle invalide. Rôles autorisés : superadmin, manager, seller' },
        { status: 400 }
      );
    }

    // Manager can only create sellers in their own store
    if (userRole === 'manager') {
      if (role !== 'seller') {
        return NextResponse.json(
          { error: 'Un manager ne peut créer que des vendeurs' },
          { status: 403 }
        );
      }
      if (store_id !== userStore) {
        return NextResponse.json(
          { error: 'Un manager ne peut créer des utilisateurs que dans son magasin' },
          { status: 403 }
        );
      }
    }

    // Check email uniqueness
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Un utilisateur avec cet email existe déjà' },
        { status: 409 }
      );
    }

    // Verify store exists
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('id', store_id)
      .single();

    if (!store) {
      return NextResponse.json(
        { error: 'Magasin introuvable' },
        { status: 400 }
      );
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    const { data, error } = await supabase
      .from('users')
      .insert({ email, name, password_hash, role, store_id })
      .select('id, email, name, role, store_id, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    journalWrite({
      event_type: 'user_created',
      entity_id: data.id,
      entity_type: 'user',
      user_id: userId || 'unknown',
      store_id: store_id,
      data: { email, name, role, store_id },
    });

    return NextResponse.json({ user: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
