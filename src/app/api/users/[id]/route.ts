import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';
import bcrypt from 'bcryptjs';

const VALID_ROLES = ['superadmin', 'manager', 'seller'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, store_id, created_at, store:stores(id, name, location)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    return NextResponse.json({ user: data });
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
    const userStore = request.headers.get('x-user-store');

    if (userRole !== 'superadmin' && userRole !== 'manager') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const supabase = createServiceClient();
    const body = await request.json();

    // Fetch the target user to check constraints
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, role, store_id')
      .eq('id', id)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    // Manager can only edit users in their store (and only sellers)
    if (userRole === 'manager') {
      if (targetUser.store_id !== userStore) {
        return NextResponse.json(
          { error: 'Vous ne pouvez modifier que les utilisateurs de votre magasin' },
          { status: 403 }
        );
      }
      if (targetUser.role !== 'seller' && targetUser.id !== userId) {
        return NextResponse.json(
          { error: 'Un manager ne peut modifier que les vendeurs' },
          { status: 403 }
        );
      }
    }

    // Prevent changing own role (privilege escalation)
    if (body.role && id === userId) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas modifier votre propre rôle' },
        { status: 403 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.name) updates.name = body.name;
    if (body.email) updates.email = body.email;
    if (body.role) {
      if (!VALID_ROLES.includes(body.role)) {
        return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
      }
      updates.role = body.role;
    }
    if (body.store_id) updates.store_id = body.store_id;

    // Re-hash password if provided
    if (body.password) {
      updates.password_hash = await bcrypt.hash(body.password, 12);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
    }

    // Check email uniqueness if changing email
    if (updates.email) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', updates.email as string)
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'Un utilisateur avec cet email existe déjà' },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, email, name, role, store_id, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Don't log password_hash in journal
    const journalData = { ...updates };
    delete journalData.password_hash;
    if (body.password) journalData.password_changed = true;

    journalWrite({
      event_type: 'user_updated',
      entity_id: id,
      entity_type: 'user',
      user_id: userId || 'unknown',
      data: journalData,
    });

    return NextResponse.json({ user: data });
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

    // Cannot delete self
    if (id === userId) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas supprimer votre propre compte' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { error } = await supabase.from('users').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    journalWrite({
      event_type: 'user_deleted',
      entity_id: id,
      entity_type: 'user',
      user_id: userId || 'unknown',
      data: { deleted_at: new Date().toISOString() },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
