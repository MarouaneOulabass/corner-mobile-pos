import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');
    const currentUserId = request.headers.get('x-user-id');

    const user_id = searchParams.get('user_id');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');

    let query = supabase
      .from('clock_records')
      .select('*, user:users(id, name, role)')
      .order('clock_in', { ascending: false });

    // Store scoping
    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    }

    // Sellers can only see their own records
    if (userRole === 'seller') {
      query = query.eq('user_id', currentUserId!);
    } else if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (date_from) query = query.gte('clock_in', date_from);
    if (date_to) query = query.lte('clock_in', date_to + 'T23:59:59');

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const records = data || [];

    // Calculate totals
    const totalHours = records.reduce((sum, r) => sum + (r.total_hours || 0), 0);
    const daysWorked = new Set(
      records.map((r) => new Date(r.clock_in).toISOString().slice(0, 10))
    ).size;

    return NextResponse.json({
      records,
      totals: {
        total_hours: Math.round(totalHours * 100) / 100,
        days_worked: daysWorked,
        record_count: records.length,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
