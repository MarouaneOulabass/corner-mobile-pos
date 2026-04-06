import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';
import {
  sendWhatsAppMessage,
  buildRepairReadyMessage,
  buildReceiptMessage,
  buildPaymentReminderMessage,
  buildWarrantyExpiryMessage,
} from '@/lib/whatsapp';

type TemplateName = 'repair_ready' | 'receipt' | 'payment_reminder' | 'warranty_expiry';

interface SendRequest {
  to: string;
  message?: string;
  template?: TemplateName;
  template_data?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  const storeId = req.headers.get('x-user-store');
  if (!userId) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  let body: SendRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requete invalide' }, { status: 400 });
  }

  const { to, template, template_data } = body;
  let { message } = body;

  if (!to) {
    return NextResponse.json({ error: 'Numero de telephone requis (to)' }, { status: 400 });
  }

  // Build message from template if provided
  if (template && template_data) {
    switch (template) {
      case 'repair_ready':
        message = buildRepairReadyMessage(
          String(template_data.customer_name || ''),
          String(template_data.device || ''),
          String(template_data.store_name || 'Corner Mobile')
        );
        break;
      case 'receipt':
        message = buildReceiptMessage(
          template_data.sale as Parameters<typeof buildReceiptMessage>[0],
          String(template_data.store_name || 'Corner Mobile')
        );
        break;
      case 'payment_reminder':
        message = buildPaymentReminderMessage(
          String(template_data.customer_name || ''),
          Number(template_data.amount || 0),
          String(template_data.due_date || '')
        );
        break;
      case 'warranty_expiry':
        message = buildWarrantyExpiryMessage(
          String(template_data.customer_name || ''),
          String(template_data.device || ''),
          String(template_data.expiry_date || '')
        );
        break;
      default:
        return NextResponse.json({ error: `Template inconnu: ${template}` }, { status: 400 });
    }
  }

  if (!message) {
    return NextResponse.json(
      { error: 'Message requis (message ou template + template_data)' },
      { status: 400 }
    );
  }

  // Send the message
  const result = await sendWhatsAppMessage(to, message);

  // Log to notifications table
  const supabase = createServiceClient();
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'whatsapp_sent',
    title: 'WhatsApp envoye',
    message: `Message envoye a ${to} via ${result.method}`,
    read: true,
    data: {
      to,
      template: template || null,
      method: result.method,
      sent: result.sent,
    },
  });

  // Journal write
  journalWrite({
    event_type: 'whatsapp_sent',
    entity_id: to,
    entity_type: 'customer',
    user_id: userId,
    store_id: storeId || undefined,
    data: {
      to,
      template: template || null,
      method: result.method,
      sent: result.sent,
      message_preview: message.slice(0, 100),
    },
  });

  return NextResponse.json({
    sent: result.sent,
    method: result.method,
    link: result.link || null,
    error: result.error || null,
  });
}
