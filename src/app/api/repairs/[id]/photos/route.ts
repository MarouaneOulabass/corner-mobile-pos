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
      .select('id, pre_photos, post_photos')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Reparation introuvable' }, { status: 404 });
    }

    return NextResponse.json({
      repair_id: data.id,
      pre_photos: data.pre_photos || [],
      post_photos: data.post_photos || [],
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(
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
    const { type, photo } = body;

    if (!type || !['pre', 'post'].includes(type)) {
      return NextResponse.json({ error: 'Type requis: "pre" ou "post"' }, { status: 400 });
    }

    if (!photo || typeof photo !== 'string') {
      return NextResponse.json({ error: 'Photo requise (data URL base64)' }, { status: 400 });
    }

    // Basic data URL validation
    if (!photo.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Format photo invalide (data:image/ attendu)' }, { status: 400 });
    }

    // Max ~5MB base64
    if (photo.length > 7_000_000) {
      return NextResponse.json({ error: 'Photo trop volumineuse (max 5 Mo)' }, { status: 400 });
    }

    // Fetch current photos
    const { data: existing, error: fetchError } = await supabase
      .from('repairs')
      .select('id, store_id, pre_photos, post_photos')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Reparation introuvable' }, { status: 404 });
    }

    const column = type === 'pre' ? 'pre_photos' : 'post_photos';
    const currentPhotos: string[] = (type === 'pre' ? existing.pre_photos : existing.post_photos) || [];

    if (currentPhotos.length >= 10) {
      return NextResponse.json({ error: 'Maximum 10 photos par type atteint' }, { status: 400 });
    }

    const updatedPhotos = [...currentPhotos, photo];

    const { data, error } = await supabase
      .from('repairs')
      .update({
        [column]: updatedPhotos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select('id, pre_photos, post_photos')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void journalWrite({
      event_type: 'repair_status_changed',
      entity_id: params.id,
      entity_type: 'repair',
      user_id: userId,
      store_id: userStore || existing.store_id,
      data: { action: 'photo_added', type, photo_count: updatedPhotos.length },
      metadata: { photo_type: type },
    });

    return NextResponse.json({
      repair_id: data.id,
      pre_photos: data.pre_photos || [],
      post_photos: data.post_photos || [],
    });
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
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const indexStr = searchParams.get('index');

    if (!type || !['pre', 'post'].includes(type)) {
      return NextResponse.json({ error: 'Type requis: "pre" ou "post"' }, { status: 400 });
    }

    if (indexStr === null || indexStr === '') {
      return NextResponse.json({ error: 'Index de la photo requis' }, { status: 400 });
    }

    const index = parseInt(indexStr, 10);
    if (isNaN(index) || index < 0) {
      return NextResponse.json({ error: 'Index invalide' }, { status: 400 });
    }

    // Fetch current photos
    const { data: existing, error: fetchError } = await supabase
      .from('repairs')
      .select('id, pre_photos, post_photos')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Reparation introuvable' }, { status: 404 });
    }

    const column = type === 'pre' ? 'pre_photos' : 'post_photos';
    const currentPhotos: string[] = (type === 'pre' ? existing.pre_photos : existing.post_photos) || [];

    if (index >= currentPhotos.length) {
      return NextResponse.json({ error: 'Index hors limites' }, { status: 400 });
    }

    const updatedPhotos = currentPhotos.filter((_, i) => i !== index);

    const { data, error } = await supabase
      .from('repairs')
      .update({
        [column]: updatedPhotos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select('id, pre_photos, post_photos')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      repair_id: data.id,
      pre_photos: data.pre_photos || [],
      post_photos: data.post_photos || [],
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
