import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';
import { PartCategory } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const lowStock = searchParams.get('low_stock');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    let query = supabase
      .from('parts_inventory')
      .select('*, supplier:suppliers(*)', { count: 'exact' });

    // Store scoping
    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      const sanitized = search.replace(/[^a-zA-Z0-9\s\-]/g, '');
      if (sanitized) {
        query = query.ilike('name', `%${sanitized}%`);
      }
    }

    query = query.order('name', { ascending: true }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let parts = data || [];

    // Filter low stock client-side (quantity < min_quantity)
    if (lowStock === 'true') {
      parts = parts.filter((p) => p.quantity < p.min_quantity);
    }

    return NextResponse.json({ parts, total: count || 0 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const userId = request.headers.get('x-user-id');
    const userStore = request.headers.get('x-user-store');

    // Validate required fields
    const required = ['name', 'category', 'quantity', 'purchase_price'];
    const missing = required.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Champs requis manquants: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories: PartCategory[] = [
      'screen', 'battery', 'charging_port', 'camera', 'speaker',
      'microphone', 'button', 'housing', 'motherboard', 'other',
    ];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 });
    }

    if (typeof body.quantity !== 'number' || body.quantity < 0) {
      return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 });
    }

    if (typeof body.purchase_price !== 'number' || body.purchase_price < 0) {
      return NextResponse.json({ error: 'Prix d\'achat invalide' }, { status: 400 });
    }

    const storeId = body.store_id || userStore;

    const { data, error } = await supabase
      .from('parts_inventory')
      .insert({
        name: body.name,
        category: body.category,
        compatible_brands: body.compatible_brands || [],
        compatible_models: body.compatible_models || [],
        sku: body.sku || null,
        quantity: body.quantity,
        min_quantity: body.min_quantity || 0,
        purchase_price: body.purchase_price,
        selling_price: body.selling_price || 0,
        supplier_id: body.supplier_id || null,
        store_id: storeId,
        bin_location: body.bin_location || null,
        notes: body.notes || null,
      })
      .select('*, supplier:suppliers(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Journal write
    journalWrite({
      event_type: 'part_created',
      entity_id: data.id,
      entity_type: 'part',
      user_id: userId || 'system',
      store_id: storeId,
      data: { ...data },
    });

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
