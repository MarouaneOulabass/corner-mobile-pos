import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { verifyPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const { password } = body as { password?: string };

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Mot de passe requis pour désactiver le 2FA.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Verify current password
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return NextResponse.json(
        { error: 'Mot de passe incorrect.' },
        { status: 401 }
      );
    }

    // Check 2FA exists
    const { data: twoFa } = await supabase
      .from('user_2fa')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!twoFa) {
      return NextResponse.json(
        { error: '2FA n\'est pas configuré.' },
        { status: 404 }
      );
    }

    // Delete 2FA record
    const { error: deleteError } = await supabase
      .from('user_2fa')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Erreur lors de la désactivation 2FA' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: '2FA désactivé.' });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
