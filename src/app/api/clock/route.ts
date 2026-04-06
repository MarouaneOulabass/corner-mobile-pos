import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    // Find current open clock record (no clock_out)
    const { data, error } = await supabase
      .from('clock_records')
      .select('*')
      .eq('user_id', userId)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      clocked_in: !!data,
      current_record: data || null,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userId = request.headers.get('x-user-id');
    const userStore = request.headers.get('x-user-store');

    if (!userId || !userStore) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    // Check not already clocked in
    const { data: existing } = await supabase
      .from('clock_records')
      .select('id')
      .eq('user_id', userId)
      .is('clock_out', null)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Deja pointe' }, { status: 409 });
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('clock_records')
      .insert({
        user_id: userId,
        store_id: userStore,
        clock_in: now,
        break_minutes: 0,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void journalWrite({
      event_type: 'clock_in',
      entity_id: data.id,
      entity_type: 'clock',
      user_id: userId,
      store_id: userStore,
      data: { clock_in: now },
    });

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userId = request.headers.get('x-user-id');
    const userStore = request.headers.get('x-user-store');

    if (!userId || !userStore) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const body = await request.json();
    const breakMinutes = body.break_minutes || 0;
    const notes = body.notes || null;

    // Find current open record
    const { data: current, error: findError } = await supabase
      .from('clock_records')
      .select('*')
      .eq('user_id', userId)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });

    if (!current) {
      return NextResponse.json({ error: 'Pas de pointage en cours' }, { status: 404 });
    }

    const now = new Date();
    const clockIn = new Date(current.clock_in);
    const diffMs = now.getTime() - clockIn.getTime();
    const totalHours = Math.round((diffMs / (1000 * 60 * 60) - breakMinutes / 60) * 100) / 100;

    const { data, error } = await supabase
      .from('clock_records')
      .update({
        clock_out: now.toISOString(),
        break_minutes: breakMinutes,
        total_hours: Math.max(0, totalHours),
        notes,
      })
      .eq('id', current.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void journalWrite({
      event_type: 'clock_out',
      entity_id: data.id,
      entity_type: 'clock',
      user_id: userId,
      store_id: userStore,
      data: { clock_out: now.toISOString(), total_hours: totalHours },
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
