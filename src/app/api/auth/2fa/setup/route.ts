import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import {
  generateTOTPSecret,
  generateRecoveryCodes,
  encryptSecret,
} from '@/lib/two-factor';
import { UserRole } from '@/types';

// Roles that require / are allowed to enable 2FA
const ELIGIBLE_ROLES: UserRole[] = ['superadmin', 'manager'];

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as UserRole | null;

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    if (!ELIGIBLE_ROLES.includes(userRole)) {
      return NextResponse.json(
        { error: 'Votre rôle ne permet pas d\'activer le 2FA' },
        { status: 403 }
      );
    }

    const supabase = createServiceClient();

    // Get user email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    // Check if 2FA already enabled
    const { data: existing } = await supabase
      .from('user_2fa')
      .select('id, enabled')
      .eq('user_id', userId)
      .single();

    if (existing?.enabled) {
      return NextResponse.json(
        { error: '2FA est déjà activé. Désactivez-le d\'abord pour reconfigurer.' },
        { status: 409 }
      );
    }

    // Generate TOTP secret and recovery codes
    const { secret, uri, qrCodeUrl } = await generateTOTPSecret(user.email);
    const recoveryCodes = generateRecoveryCodes();
    const encryptedSecret = await encryptSecret(secret);

    // Upsert into user_2fa (enabled=false until verified)
    const row = {
      user_id: userId,
      encrypted_secret: encryptedSecret,
      recovery_codes: recoveryCodes,
      enabled: false,
      verified_at: null,
    };

    if (existing) {
      const { error: updateError } = await supabase
        .from('user_2fa')
        .update(row)
        .eq('user_id', userId);

      if (updateError) {
        return NextResponse.json(
          { error: 'Erreur lors de la mise à jour 2FA' },
          { status: 500 }
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from('user_2fa')
        .insert(row);

      if (insertError) {
        return NextResponse.json(
          { error: 'Erreur lors de la configuration 2FA' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      uri,
      qrCodeUrl,
      recoveryCodes,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
