import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const userId = request.headers.get('x-user-id');
    const userStore = request.headers.get('x-user-store');

    const { signature_data, repair_id, customer_id } = body;

    if (!signature_data) {
      return NextResponse.json({ error: 'signature_data requis' }, { status: 400 });
    }

    if (!repair_id && !customer_id) {
      return NextResponse.json(
        { error: 'repair_id ou customer_id requis' },
        { status: 400 }
      );
    }

    // Validate base64 data URL
    if (!signature_data.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Format de signature invalide' }, { status: 400 });
    }

    // Create signature record
    const insertData: Record<string, unknown> = {
      signature_data,
      signed_at: new Date().toISOString(),
    };
    if (repair_id) insertData.repair_id = repair_id;
    if (customer_id) insertData.customer_id = customer_id;

    const { data: sig, error: sigErr } = await supabase
      .from('signatures')
      .insert(insertData)
      .select()
      .single();

    if (sigErr) {
      return NextResponse.json({ error: sigErr.message }, { status: 500 });
    }

    // If repair_id, update repair.signature_url
    if (repair_id) {
      await supabase
        .from('repairs')
        .update({ signature_url: sig.id })
        .eq('id', repair_id);
    }

    // Journal write
    const entityType = repair_id ? 'repair' : 'customer';
    const entityId = repair_id || customer_id;

    journalWrite({
      event_type: 'signature_captured',
      entity_id: entityId,
      entity_type: entityType as 'repair' | 'customer',
      user_id: userId || 'system',
      store_id: userStore || undefined,
      data: {
        signature_id: sig.id,
        repair_id: repair_id || null,
        customer_id: customer_id || null,
      },
    });

    return NextResponse.json({ signature: sig });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
