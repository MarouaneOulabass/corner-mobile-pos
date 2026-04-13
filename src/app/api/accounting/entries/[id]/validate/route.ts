import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, hasPermission } from '@/lib/auth';
import { validateJournalEntry } from '@/modules/accounting/services/journal-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = getAuthContext(request);

    if (!hasPermission(role, 'manager')) {
      return NextResponse.json({ error: 'Acces refuse — manager ou superadmin requis' }, { status: 403 });
    }

    const { id } = await params;
    const entry = await validateJournalEntry(id, userId);
    return NextResponse.json(entry);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('already locked')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    const status = message.includes('authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
