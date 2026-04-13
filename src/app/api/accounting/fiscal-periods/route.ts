import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, hasPermission } from '@/lib/auth';
import { getFiscalPeriods, closeFiscalPeriod } from '@/modules/accounting/services/fiscal-service';

export async function GET(request: NextRequest) {
  try {
    const { orgId } = getAuthContext(request);
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : undefined;

    const periods = await getFiscalPeriods(orgId, year);
    return NextResponse.json({ periods });
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
    const { year, month } = body;

    if (!year || !month) {
      return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
    }

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: 'month must be between 1 and 12' }, { status: 400 });
    }

    const period = await closeFiscalPeriod(orgId, year, month, userId);
    return NextResponse.json(period);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('already closed') || message.includes('Cannot close')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    const status = message.includes('authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
