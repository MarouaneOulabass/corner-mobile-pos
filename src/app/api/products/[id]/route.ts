import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const userRole = request.headers.get('x-user-role');
    const userStore = request.headers.get('x-user-store');

    const { data, error } = await supabase
      .from('products')
      .select('*, store:stores(*)')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    // Store scoping: non-superadmin users can only view products from their store
    if (userRole !== 'superadmin' && userStore && data.store_id !== userStore) {
      return NextResponse.json(
        { error: 'Permission refusée. Ce produit n\'appartient pas à votre magasin.' },
        { status: 403 }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const userRole = request.headers.get('x-user-role');
    const userStore = request.headers.get('x-user-store');

    // Fetch existing product for store scoping check
    const { data: existing, error: fetchError } = await supabase
      .from('products')
      .select('id, store_id, status')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    // Store scoping: non-superadmin users can only update products from their store
    if (userRole !== 'superadmin' && userStore && existing.store_id !== userStore) {
      return NextResponse.json(
        { error: 'Permission refusée. Ce produit n\'appartient pas à votre magasin.' },
        { status: 403 }
      );
    }

    // Role-based field restrictions
    let allowedFields: string[];
    if (userRole === 'superadmin') {
      // Superadmin can update all product fields (except system fields)
      allowedFields = [
        'product_type', 'brand', 'model', 'storage', 'color', 'condition',
        'purchase_price', 'selling_price', 'imei', 'supplier', 'notes',
        'purchase_date', 'store_id', 'status',
      ];
    } else if (userRole === 'manager') {
      allowedFields = ['selling_price', 'notes', 'color', 'condition'];
    } else {
      // seller or other roles
      allowedFields = ['notes'];
    }

    // Filter body to only allowed fields
    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Aucun champ autorisé à mettre à jour pour votre rôle.' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('*, store:stores(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    void journalWrite({ event_type: 'product_updated', entity_id: params.id, entity_type: 'product', user_id: request.headers.get('x-user-id') || 'unknown', store_id: existing.store_id, data: { old: existing, new: data } });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const userRole = request.headers.get('x-user-role');

    // Only manager+ can delete
    if (!userRole || !['manager', 'superadmin'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Permission refusée. Rôle manager ou supérieur requis.' },
        { status: 403 }
      );
    }

    // Check product status — cannot delete sold products
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, status, store_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    if (product.status === 'sold') {
      return NextResponse.json(
        { error: 'Impossible de supprimer un produit vendu.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void journalWrite({ event_type: 'product_deleted', entity_id: params.id, entity_type: 'product', user_id: request.headers.get('x-user-id') || 'unknown', store_id: product.store_id || 'unknown', data: product });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
