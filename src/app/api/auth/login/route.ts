import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createToken } from '@/lib/auth';

// Simple in-memory rate limiter (per IP, 5 attempts per minute)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  record.count++;
  return record.count <= MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans une minute.' },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Format invalide' }, { status: 400 });
    }

    const user = await authenticateUser(email.toLowerCase().trim(), password);
    if (!user) {
      return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 });
    }

    const token = await createToken(user);

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        store_id: user.store_id,
        store: user.store,
      },
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours (reduced from 24)
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
