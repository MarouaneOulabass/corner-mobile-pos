import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { SignJWT, jwtVerify } from 'jose';
import { decryptSecret, verifyTOTP, verifyRecoveryCode } from '@/lib/two-factor';
import { createSession } from '@/lib/sessions';
import { UserRole } from '@/types';

function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('NEXTAUTH_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

const JWT_EXPIRY = '8h';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tempToken, code } = body as { tempToken?: string; code?: string };

    if (!tempToken || typeof tempToken !== 'string') {
      return NextResponse.json({ error: 'Token temporaire requis' }, { status: 400 });
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code 2FA requis' }, { status: 400 });
    }

    // Verify the temp token
    let payload;
    try {
      const result = await jwtVerify(tempToken, getJwtSecret());
      payload = result.payload;
    } catch {
      return NextResponse.json({ error: 'Token temporaire invalide ou expiré' }, { status: 401 });
    }

    if (payload.purpose !== '2fa_pending') {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    }

    const userId = payload.sub as string;
    const supabase = createServiceClient();

    // Get 2FA config
    const { data: twoFa, error: fetchError } = await supabase
      .from('user_2fa')
      .select('encrypted_secret, recovery_codes, enabled')
      .eq('user_id', userId)
      .single();

    if (fetchError || !twoFa || !twoFa.enabled) {
      return NextResponse.json({ error: '2FA non configuré' }, { status: 400 });
    }

    const secret = await decryptSecret(twoFa.encrypted_secret);
    let valid = false;
    let isRecoveryCode = false;

    // Try TOTP first (6 digits)
    if (/^\d{6}$/.test(code)) {
      valid = verifyTOTP(secret, code);
    }

    // Try recovery code if TOTP failed
    if (!valid) {
      const result = verifyRecoveryCode(twoFa.recovery_codes ?? [], code);
      if (result.valid) {
        valid = true;
        isRecoveryCode = true;

        // Remove used recovery code
        await supabase
          .from('user_2fa')
          .update({ recovery_codes: result.remaining })
          .eq('user_id', userId);
      }
    }

    if (!valid) {
      return NextResponse.json({ error: 'Code 2FA incorrect' }, { status: 401 });
    }

    // Fetch full user data for the JWT
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*, store:stores(*)')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    // Create server-side session
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    const { jti } = await createSession(userId, ip, userAgent, expiresAt);

    // Create full JWT with jti claim
    const token = await new SignJWT({
      sub: user.id,
      aud: 'authenticated',
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      store_id: user.store_id,
      jti,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRY)
      .sign(getJwtSecret());

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        store_id: user.store_id,
        store: user.store,
      },
      token,
      usedRecoveryCode: isRecoveryCode,
      remainingRecoveryCodes: isRecoveryCode
        ? (twoFa.recovery_codes?.length ?? 0) - 1
        : undefined,
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
