import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Magasin introuvable' }, { status: 404 });
    }

    return NextResponse.json({ store: data });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (userRole !== 'superadmin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const supabase = createServiceClient();
    const body = await request.json();

    const updates: Record<string, string> = {};
    if (body.name) updates.name = body.name;
    if (body.location) updates.location = body.location;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    journalWrite({
      event_type: 'store_updated',
      entity_id: id,
      entity_type: 'store',
      user_id: userId || 'unknown',
      data: updates,
    });

    return NextResponse.json({ store: data });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (userRole !== 'superadmin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const supabase = createServiceClient();

    // Check for linked users
    const { count: userCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', id);

    if (userCount && userCount > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer : des utilisateurs sont liés à ce magasin' },
        { status: 409 }
      );
    }

    // Check for linked products
    const { count: productCount } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', id);

    if (productCount && productCount > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer : des produits sont liés à ce magasin' },
        { status: 409 }
      );
    }

    const { error } = await supabase.from('stores').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    journalWrite({
      event_type: 'store_deleted',
      entity_id: id,
      entity_type: 'store',
      user_id: userId || 'unknown',
      data: { deleted_at: new Date().toISOString() },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
