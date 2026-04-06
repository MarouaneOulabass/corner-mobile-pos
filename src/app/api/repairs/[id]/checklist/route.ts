import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('repairs')
      .select('id, pre_checklist, post_checklist')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Reparation introuvable' }, { status: 404 });
    }

    return NextResponse.json({
      repair_id: data.id,
      pre_checklist: data.pre_checklist || {},
      post_checklist: data.post_checklist || {},
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const userId = request.headers.get('x-user-id');
    const userStore = request.headers.get('x-user-store');

    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
    }

    const body = await request.json();
    const { type, checklist } = body;

    if (!type || !['pre', 'post'].includes(type)) {
      return NextResponse.json({ error: 'Type requis: "pre" ou "post"' }, { status: 400 });
    }

    if (!checklist || typeof checklist !== 'object') {
      return NextResponse.json({ error: 'Checklist requise (objet cle-valeur)' }, { status: 400 });
    }

    // Verify repair exists
    const { data: existing, error: fetchError } = await supabase
      .from('repairs')
      .select('id, store_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Reparation introuvable' }, { status: 404 });
    }

    const column = type === 'pre' ? 'pre_checklist' : 'post_checklist';

    const { data, error } = await supabase
      .from('repairs')
      .update({
        [column]: checklist,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select('id, pre_checklist, post_checklist')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void journalWrite({
      event_type: 'checklist_completed',
      entity_id: params.id,
      entity_type: 'checklist',
      user_id: userId,
      store_id: userStore || existing.store_id,
      data: { type, checklist },
    });

    return NextResponse.json({
      repair_id: data.id,
      pre_checklist: data.pre_checklist || {},
      post_checklist: data.post_checklist || {},
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
