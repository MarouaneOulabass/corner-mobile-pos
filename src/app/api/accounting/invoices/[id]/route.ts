import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getInvoice } from '@/modules/accounting/services/invoice-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    getAuthContext(request); // Ensure authenticated

    const { id } = await params;
    const invoice = await getInvoice(id);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    if (message.includes('not found') || message.includes('No rows')) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    const status = message.includes('authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
