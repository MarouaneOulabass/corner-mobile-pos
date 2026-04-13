import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getTrialBalance } from '@/modules/accounting/services/journal-service';

export async function GET(request: NextRequest) {
  try {
    const { orgId } = getAuthContext(request);
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const asOfDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const rows = await getTrialBalance(orgId, asOfDate);

    // Calculate totals
    const totalDebit = rows.reduce((s, r) => s + r.total_debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.total_credit, 0);

    return NextResponse.json({
      as_of_date: asOfDate,
      rows,
      totals: {
        debit: Math.round(totalDebit * 100) / 100,
        credit: Math.round(totalCredit * 100) / 100,
        balanced: Math.abs(totalDebit - totalCredit) < 0.01,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    const status = message.includes('authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
