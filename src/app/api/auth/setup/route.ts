import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth';

// POST /api/auth/setup — Initialize stores and users
// Only works if no users exist yet (one-time setup)
export async function POST() {
  // Block in production unless ALLOW_SETUP=true
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SETUP !== 'true') {
    return NextResponse.json({ error: 'Setup désactivé en production' }, { status: 403 });
  }

  try {
    const supabase = createServiceClient();

    // Check if users already exist — abort if so
    const { count } = await supabase.from('users').select('id', { count: 'exact', head: true });
    if (count && count > 0) {
      return NextResponse.json({ error: 'La base contient déjà des utilisateurs. Setup annulé.' }, { status: 409 });
    }

    const password = await hashPassword('corner2024');

    // Create stores
    const { error: storesError } = await supabase.from('stores').upsert([
      { id: 'a0000000-0000-0000-0000-000000000001', name: 'Corner Mobile M1', location: 'Centre Commercial Aït Baha, Rabat' },
      { id: 'a0000000-0000-0000-0000-000000000002', name: 'Corner Mobile M2', location: 'Centre Commercial Oued Dahab, Rabat' },
    ], { onConflict: 'id' });

    if (storesError) {
      return NextResponse.json({ error: 'Stores: ' + storesError.message }, { status: 500 });
    }

    // Create users (no credentials in response)
    const users = [
      { id: 'b0000000-0000-0000-0000-000000000001', email: 'admin@cornermobile.ma', name: 'Admin Corner', role: 'superadmin', store_id: 'a0000000-0000-0000-0000-000000000001', password_hash: password },
      { id: 'b0000000-0000-0000-0000-000000000002', email: 'manager.m1@cornermobile.ma', name: 'Youssef Manager', role: 'manager', store_id: 'a0000000-0000-0000-0000-000000000001', password_hash: password },
      { id: 'b0000000-0000-0000-0000-000000000003', email: 'manager.m2@cornermobile.ma', name: 'Karim Manager', role: 'manager', store_id: 'a0000000-0000-0000-0000-000000000002', password_hash: password },
      { id: 'b0000000-0000-0000-0000-000000000004', email: 'seller.m1@cornermobile.ma', name: 'Ahmed Vendeur', role: 'seller', store_id: 'a0000000-0000-0000-0000-000000000001', password_hash: password },
      { id: 'b0000000-0000-0000-0000-000000000005', email: 'seller.m2@cornermobile.ma', name: 'Omar Vendeur', role: 'seller', store_id: 'a0000000-0000-0000-0000-000000000002', password_hash: password },
    ];

    const { error: usersError } = await supabase.from('users').upsert(users, { onConflict: 'id' });

    if (usersError) {
      return NextResponse.json({ error: 'Users: ' + usersError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Base initialisée. Changez les mots de passe par défaut immédiatement.',
      users_created: users.map(u => ({ email: u.email, role: u.role })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Setup failed: ' + String(error) }, { status: 500 });
  }
}
