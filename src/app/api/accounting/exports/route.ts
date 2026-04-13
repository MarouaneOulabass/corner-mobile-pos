import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, hasPermission } from '@/lib/auth';
import { exportToCSV, exportSageFormat } from '@/modules/accounting/services/export-service';

export async function GET(request: NextRequest) {
  try {
    const { orgId, role } = getAuthContext(request);

    if (!hasPermission(role, 'manager')) {
      return NextResponse.json({ error: 'Acces refuse — manager ou superadmin requis' }, { status: 403 });
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const journal = searchParams.get('journal') || '';
    const dateFrom = searchParams.get('from');
    const dateTo = searchParams.get('to');

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'from and to date parameters are required' }, { status: 400 });
    }

    let content: string;
    let filename: string;
    let contentType: string;

    if (format === 'sage') {
      content = await exportSageFormat(orgId, dateFrom, dateTo);
      filename = `export_sage_${dateFrom}_${dateTo}.txt`;
      contentType = 'text/plain; charset=utf-8';
    } else {
      if (!journal) {
        return NextResponse.json({ error: 'journal parameter is required for CSV export' }, { status: 400 });
      }
      content = await exportToCSV(orgId, journal, dateFrom, dateTo);
      filename = `export_${journal}_${dateFrom}_${dateTo}.csv`;
      contentType = 'text/csv; charset=utf-8';
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    const status = message.includes('authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
