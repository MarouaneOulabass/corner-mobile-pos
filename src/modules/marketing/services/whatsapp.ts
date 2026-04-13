import { Sale } from '@/types';
import { formatPrice, generateWhatsAppLink } from '@/lib/utils';

// ============================================================
// WhatsApp Business API integration + wa.me fallback
// ============================================================

export interface WhatsAppConfig {
  apiToken?: string;
  phoneNumberId?: string;
  enabled: boolean;
}

export interface WhatsAppResult {
  sent: boolean;
  method: 'api' | 'link';
  link?: string;
  messageId?: string;
  error?: string;
}

/**
 * Read WhatsApp configuration from environment variables.
 * If WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set, API mode is enabled.
 * Otherwise, falls back to wa.me link generation.
 */
export function getWhatsAppConfig(): WhatsAppConfig {
  const apiToken = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const enabled = !!(apiToken && phoneNumberId);

  return {
    apiToken: apiToken || undefined,
    phoneNumberId: phoneNumberId || undefined,
    enabled,
  };
}

/**
 * Normalize a Moroccan phone number to international format (212XXXXXXXXX).
 */
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('212')) return cleaned;
  if (cleaned.startsWith('0')) return `212${cleaned.slice(1)}`;
  return `212${cleaned}`;
}

/**
 * Send a WhatsApp message via Meta Cloud API or generate a wa.me link as fallback.
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<WhatsAppResult> {
  const config = getWhatsAppConfig();
  const normalizedPhone = normalizePhone(to);

  // If API is configured, try sending via Meta Cloud API
  if (config.enabled && config.apiToken && config.phoneNumberId) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: normalizedPhone,
            type: 'text',
            text: { body: message },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          sent: true,
          method: 'api',
          messageId: data.messages?.[0]?.id,
        };
      }

      // API call failed — fall through to link fallback
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = (errorData as Record<string, unknown>).error
        ? String((errorData as Record<string, unknown>).error)
        : `HTTP ${response.status}`;

      return {
        sent: false,
        method: 'api',
        error: errorMsg,
        link: generateWhatsAppLink(to, message),
      };
    } catch (err) {
      // Network error — return link fallback
      return {
        sent: false,
        method: 'api',
        error: err instanceof Error ? err.message : 'Network error',
        link: generateWhatsAppLink(to, message),
      };
    }
  }

  // No API config — generate wa.me link for manual sending
  return {
    sent: false,
    method: 'link',
    link: generateWhatsAppLink(to, message),
  };
}

// ============================================================
// Message template builders
// ============================================================

/**
 * Build message for repair ready notification.
 */
export function buildRepairReadyMessage(
  customerName: string,
  device: string,
  storeName: string
): string {
  return (
    `Bonjour ${customerName},\n\n` +
    `Votre ${device} est pret a etre recupere chez Corner Mobile (${storeName}).\n\n` +
    `Merci de passer en magasin pendant les heures d'ouverture.\n\n` +
    `A bientot !\nCorner Mobile`
  );
}

/**
 * Build message for sharing a sale receipt via WhatsApp.
 */
export function buildReceiptMessage(
  sale: Sale,
  storeName: string
): string {
  const lines: string[] = [
    `--- Recu Corner Mobile ---`,
    `Magasin: ${storeName}`,
    `Date: ${new Date(sale.created_at).toLocaleDateString('fr-FR')}`,
    `Ref: ${sale.id.slice(0, 8).toUpperCase()}`,
    ``,
  ];

  if (sale.items && sale.items.length > 0) {
    for (const item of sale.items) {
      const name = item.product
        ? `${item.product.brand} ${item.product.model}`
        : `Article`;
      lines.push(`${name} x${item.quantity} — ${formatPrice(item.unit_price)}`);
    }
    lines.push(``);
  }

  if (sale.discount_amount > 0) {
    lines.push(`Remise: -${formatPrice(sale.discount_amount)}`);
  }

  lines.push(`TOTAL: ${formatPrice(sale.total)}`);
  lines.push(``);
  lines.push(`Merci pour votre achat !`);
  lines.push(`Corner Mobile`);

  return lines.join('\n');
}

/**
 * Build message for payment reminder (installment due).
 */
export function buildPaymentReminderMessage(
  customerName: string,
  amount: number,
  dueDate: string
): string {
  const formattedDate = new Date(dueDate).toLocaleDateString('fr-FR');
  return (
    `Bonjour ${customerName},\n\n` +
    `Nous vous rappelons qu'un paiement de ${formatPrice(amount)} ` +
    `est prevu pour le ${formattedDate}.\n\n` +
    `Merci de passer en magasin pour effectuer votre reglement.\n\n` +
    `Corner Mobile`
  );
}

/**
 * Build message for warranty expiry notification.
 */
export function buildWarrantyExpiryMessage(
  customerName: string,
  device: string,
  expiryDate: string
): string {
  const formattedDate = new Date(expiryDate).toLocaleDateString('fr-FR');
  return (
    `Bonjour ${customerName},\n\n` +
    `La garantie de votre ${device} expire le ${formattedDate}.\n\n` +
    `Si vous rencontrez un probleme, n'hesitez pas a nous contacter avant cette date.\n\n` +
    `Corner Mobile`
  );
}
