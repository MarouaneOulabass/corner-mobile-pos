import { NextRequest, NextResponse } from 'next/server';
import { journalExport, fullSnapshot } from '@/lib/backup';

// GET /api/backup?type=journal|snapshot — Export data for backup
export async function GET(request: NextRequest) {
  const userRole = request.headers.get('x-user-role');
  if (userRole !== 'superadmin') {
    return NextResponse.json({ error: 'Superadmin requis' }, { status: 403 });
  }

  const type = new URL(request.url).searchParams.get('type') || 'snapshot';
  const from = new URL(request.url).searchParams.get('from') || undefined;

  if (type === 'journal') {
    const events = await journalExport(from);
    return NextResponse.json({ events, count: events.length });
  }

  const snapshot = await fullSnapshot();
  return NextResponse.json(snapshot);
}
