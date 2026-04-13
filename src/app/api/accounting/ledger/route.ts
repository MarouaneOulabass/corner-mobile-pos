import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getLedger } from '@/modules/accounting/services/journal-service';

export async function GET(request: NextRequest) {
  try {
    const { orgId } = getAuthContext(request);
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const accountCode = searchParams.get('account');
    const dateFrom = searchParams.get('from') || undefined;
    const dateTo = searchParams.get('to') || undefined;

    if (!accountCode) {
      return NextResponse.json({ error: 'account parameter is required' }, { status: 400 });
    }

    const ledger = await getLedger(orgId, accountCode, dateFrom, dateTo);
    return NextResponse.json({ account: accountCode, lines: ledger });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    const status = message.includes('authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
