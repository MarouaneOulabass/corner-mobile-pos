import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { decryptSecret, verifyTOTP } from '@/lib/two-factor';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body as { token?: string };

    if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: 'Code TOTP invalide. Entrez un code à 6 chiffres.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch pending 2FA setup
    const { data: twoFa, error: fetchError } = await supabase
      .from('user_2fa')
      .select('encrypted_secret, enabled')
      .eq('user_id', userId)
      .single();

    if (fetchError || !twoFa) {
      return NextResponse.json(
        { error: 'Configuration 2FA introuvable. Lancez d\'abord la configuration.' },
        { status: 404 }
      );
    }

    if (twoFa.enabled) {
      return NextResponse.json(
        { error: '2FA est déjà activé.' },
        { status: 409 }
      );
    }

    // Decrypt and verify
    const secret = await decryptSecret(twoFa.encrypted_secret);
    const valid = verifyTOTP(secret, token);

    if (!valid) {
      return NextResponse.json(
        { error: 'Code TOTP incorrect. Réessayez.' },
        { status: 401 }
      );
    }

    // Enable 2FA
    const { error: updateError } = await supabase
      .from('user_2fa')
      .update({
        enabled: true,
        verified_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Erreur lors de l\'activation 2FA' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: '2FA activé avec succès.' });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
