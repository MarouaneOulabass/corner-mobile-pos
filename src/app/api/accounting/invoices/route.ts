import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, hasPermission } from '@/lib/auth';
import { createInvoice, listInvoices } from '@/modules/accounting/services/invoice-service';

export async function GET(request: NextRequest) {
  try {
    const { orgId } = getAuthContext(request);
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listInvoices(orgId, {
      storeId: searchParams.get('store_id') || undefined,
      status: searchParams.get('status') || undefined,
      dateFrom: searchParams.get('from') || undefined,
      dateTo: searchParams.get('to') || undefined,
      customerId: searchParams.get('customer_id') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '20', 10),
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    const status = message.includes('authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, userId, storeId, role } = getAuthContext(request);

    if (!hasPermission(role, 'manager')) {
      return NextResponse.json({ error: 'Acces refuse — manager ou superadmin requis' }, { status: 403 });
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { customerId, items, saleId, iceClient, dueDate } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required and must not be empty' }, { status: 400 });
    }

    const invoice = await createInvoice({
      orgId,
      storeId: body.storeId || storeId,
      saleId,
      customerId,
      items: items.map((i: { label: string; qty: number; unitPriceHT: number; taxRateId: string }) => ({
        label: i.label,
        qty: Number(i.qty),
        unitPriceHT: Number(i.unitPriceHT),
        taxRateId: i.taxRateId,
      })),
      iceClient,
      dueDate,
      createdBy: userId,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    if (message.includes('not found') || message.includes('at least')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const status = message.includes('authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
