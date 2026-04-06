import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { hasPermission } from '@/lib/auth';
import { UserRole } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role') as UserRole | null;

    let query = supabase
      .from('checklist_templates')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    // Return global templates (store_id IS NULL) + store-specific ones
    if (userRole !== 'superadmin' && userStore) {
      query = query.or(`store_id.is.null,store_id.eq.${userStore}`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ templates: data || [] });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as UserRole | null;
    const userStore = request.headers.get('x-user-store');

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
    }

    if (!hasPermission(userRole, 'manager')) {
      return NextResponse.json({ error: 'Permission insuffisante' }, { status: 403 });
    }

    const body = await request.json();
    const { name, items, store_id } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nom du template requis' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Au moins un element requis' }, { status: 400 });
    }

    // Validate each item
    for (const item of items) {
      if (!item.key || !item.label || !item.type) {
        return NextResponse.json({ error: 'Chaque element doit avoir key, label et type' }, { status: 400 });
      }
      if (!['boolean', 'select', 'text'].includes(item.type)) {
        return NextResponse.json({ error: `Type invalide: ${item.type}` }, { status: 400 });
      }
      if (item.type === 'select' && (!item.options || !Array.isArray(item.options) || item.options.length === 0)) {
        return NextResponse.json({ error: `Options requises pour le type select (${item.key})` }, { status: 400 });
      }
    }

    // Non-superadmin can only create for their own store
    const effectiveStoreId = store_id === null ? null : (store_id || userStore);
    if (userRole !== 'superadmin' && effectiveStoreId === null) {
      return NextResponse.json({ error: 'Seul un superadmin peut creer un template global' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('checklist_templates')
      .insert({
        name: name.trim(),
        items,
        store_id: effectiveStoreId,
        active: true,
      })
      .select()
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
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as UserRole | null;

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
    }

    if (!hasPermission(userRole, 'manager')) {
      return NextResponse.json({ error: 'Permission insuffisante' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, items, active } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID du template requis' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'Au moins un element requis' }, { status: 400 });
      }
      updates.items = items;
    }
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabase
      .from('checklist_templates')
      .update(updates)
      .eq('id', id)
      .select()
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
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as UserRole | null;

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
    }

    if (!hasPermission(userRole, 'manager')) {
      return NextResponse.json({ error: 'Permission insuffisante' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID du template requis' }, { status: 400 });
    }

    // Soft delete — set active to false
    const { error } = await supabase
      .from('checklist_templates')
      .update({ active: false })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
