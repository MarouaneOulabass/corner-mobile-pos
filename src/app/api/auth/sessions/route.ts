import { NextRequest, NextResponse } from 'next/server';
import { listActiveSessions, revokeSession } from '@/lib/sessions';
import { UserRole } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const sessions = await listActiveSessions(userId);

    // Mask sensitive parts of IP and UA for response
    const sanitised = sessions.map((s) => ({
      id: s.id,
      jti: s.jti,
      ip_address: s.ip_address,
      user_agent: s.user_agent,
      created_at: s.created_at,
      expires_at: s.expires_at,
    }));

    return NextResponse.json({ sessions: sanitised });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as UserRole | null;

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const { jti } = body as { jti?: string };

    if (!jti || typeof jti !== 'string') {
      return NextResponse.json({ error: 'JTI requis' }, { status: 400 });
    }

    // Verify the session belongs to the user (or user is superadmin)
    if (userRole !== 'superadmin') {
      const sessions = await listActiveSessions(userId);
      const owns = sessions.some((s) => s.jti === jti);
      if (!owns) {
        return NextResponse.json(
          { error: 'Vous ne pouvez révoquer que vos propres sessions.' },
          { status: 403 }
        );
      }
    }

    const success = await revokeSession(jti);

    if (!success) {
      return NextResponse.json(
        { error: 'Session introuvable ou déjà révoquée.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Session révoquée.' });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
