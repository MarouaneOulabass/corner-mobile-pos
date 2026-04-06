import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

// Default template values
const DEFAULT_TEMPLATE = {
  header_text: '',
  footer_text: 'Merci de votre visite !',
  show_logo: false,
  show_store_address: true,
  show_seller_name: true,
  show_qr_code: false,
  paper_width: '80mm',
  font_size: 'medium',
};

/**
 * GET — Fetch receipt template for the user's store (or return default).
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const userStore = request.headers.get('x-user-store');

  if (!userId) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  if (!userStore) {
    return NextResponse.json({ error: 'Magasin non defini' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('receipt_templates')
      .select('*')
      .eq('store_id', userStore)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is ok — we return default
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data) {
      return NextResponse.json({ template: data });
    }

    // Return default template with store_id
    return NextResponse.json({
      template: {
        ...DEFAULT_TEMPLATE,
        store_id: userStore,
        id: null,
        updated_at: null,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * PUT — Update (or create) receipt template for the user's store.
 * Requires manager or superadmin role.
 */
export async function PUT(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const userRole = request.headers.get('x-user-role');
  const userStore = request.headers.get('x-user-store');

  if (!userId) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  if (!userRole || !['superadmin', 'manager'].includes(userRole)) {
    return NextResponse.json({ error: 'Acces refuse — manager minimum requis' }, { status: 403 });
  }

  if (!userStore) {
    return NextResponse.json({ error: 'Magasin non defini' }, { status: 400 });
  }

  try {
    const body = await request.json();

    // Validate allowed fields
    const allowedFields = [
      'header_text', 'footer_text', 'show_logo', 'show_store_address',
      'show_seller_name', 'show_qr_code', 'paper_width', 'font_size',
    ];

    const updateData: Record<string, unknown> = {
      store_id: userStore,
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (field in body) {
        // Validate specific field values
        if (field === 'paper_width' && !['58mm', '80mm'].includes(body[field])) {
          return NextResponse.json({ error: 'paper_width invalide (58mm ou 80mm)' }, { status: 400 });
        }
        if (field === 'font_size' && !['small', 'medium', 'large'].includes(body[field])) {
          return NextResponse.json({ error: 'font_size invalide (small, medium, large)' }, { status: 400 });
        }
        if (typeof body[field] === 'string' && body[field].length > 500) {
          return NextResponse.json({ error: `${field} trop long (max 500 caracteres)` }, { status: 400 });
        }
        updateData[field] = body[field];
      }
    }

    const supabase = createServiceClient();

    // Check if template exists for this store
    const { data: existing } = await supabase
      .from('receipt_templates')
      .select('id')
      .eq('store_id', userStore)
      .single();

    let result;
    if (existing) {
      // Update existing
      result = await supabase
        .from('receipt_templates')
        .update(updateData)
        .eq('store_id', userStore)
        .select()
        .single();
    } else {
      // Insert new with defaults
      result = await supabase
        .from('receipt_templates')
        .insert({ ...DEFAULT_TEMPLATE, ...updateData })
        .select()
        .single();
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    // Journal write
    journalWrite({
      event_type: 'product_updated', // Using existing event type for template update
      entity_id: result.data.id,
      entity_type: 'product',
      user_id: userId,
      store_id: userStore,
      data: {
        action: 'receipt_template_updated',
        template: updateData,
      },
    });

    return NextResponse.json({ template: result.data });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
