import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getAuthContext, hasPermission } from '@/lib/auth';
import { getChartOfAccounts } from '@/modules/accounting/services/journal-service';

export async function GET(request: NextRequest) {
  try {
    const { orgId } = getAuthContext(request);
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const accounts = await getChartOfAccounts(orgId);
    return NextResponse.json({ accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, role } = getAuthContext(request);

    if (!hasPermission(role, 'superadmin')) {
      return NextResponse.json({ error: 'Acces refuse — superadmin requis' }, { status: 403 });
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { code, label, type, parentId } = body;

    if (!code || !label || !type) {
      return NextResponse.json({ error: 'code, label, and type are required' }, { status: 400 });
    }

    const validTypes = ['class1', 'class2', 'class3', 'class4', 'class5', 'class6', 'class7'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .insert({
        organization_id: orgId,
        code,
        label,
        type,
        parent_id: parentId || null,
      })
      .select('*')
      .single();

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return NextResponse.json({ error: `Account code '${code}' already exists` }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    const status = message.includes('authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
