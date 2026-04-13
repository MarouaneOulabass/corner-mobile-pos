import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, hasPermission } from '@/lib/auth';
import { getVATDeclaration, generateVATDeclaration } from '@/modules/accounting/services/tax-service';

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
    const periodStart = searchParams.get('period_start');
    const periodEnd = searchParams.get('period_end');
    const generate = searchParams.get('generate') === 'true';

    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: 'period_start and period_end are required' }, { status: 400 });
    }

    if (generate) {
      const declaration = await generateVATDeclaration(orgId, periodStart, periodEnd);
      return NextResponse.json(declaration);
    }

    // Try to fetch existing
    const declaration = await getVATDeclaration(orgId, periodStart, periodEnd);
    if (!declaration) {
      // Auto-generate if not found
      const generated = await generateVATDeclaration(orgId, periodStart, periodEnd);
      return NextResponse.json(generated);
    }

    return NextResponse.json(declaration);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    const status = message.includes('authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
