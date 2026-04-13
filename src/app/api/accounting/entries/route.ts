import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, hasPermission } from '@/lib/auth';
import { getJournalEntries, createJournalEntry } from '@/modules/accounting/services/journal-service';

export async function GET(request: NextRequest) {
  try {
    const { orgId } = getAuthContext(request);
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const journalCode = searchParams.get('journal') || undefined;
    const dateFrom = searchParams.get('from') || undefined;
    const dateTo = searchParams.get('to') || undefined;
    const accountCode = searchParams.get('account') || undefined;

    const entries = await getJournalEntries(orgId, { journalCode, dateFrom, dateTo, accountCode });
    return NextResponse.json({ entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    const status = message.includes('authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, userId, role } = getAuthContext(request);

    if (!hasPermission(role, 'manager')) {
      return NextResponse.json({ error: 'Acces refuse — manager ou superadmin requis' }, { status: 403 });
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { date, label, lines } = body;

    if (!date || !label || !lines || !Array.isArray(lines)) {
      return NextResponse.json({ error: 'date, label, and lines are required' }, { status: 400 });
    }

    // Manual entries go to OD journal
    const entry = await createJournalEntry({
      orgId,
      journalCode: 'OD',
      date,
      label,
      lines: lines.map((l: { accountCode: string; debit: number; credit: number; label?: string }) => ({
        accountCode: l.accountCode,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        label: l.label,
      })),
      createdBy: userId,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    if (message.includes('unbalanced') || message.includes('must have') || message.includes('Unknown account')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const status = message.includes('authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
