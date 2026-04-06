import { type ClassValue, clsx } from 'clsx';

// Simple class merge utility (no tailwind-merge dependency needed for basic usage)
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Format price in MAD
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('fr-MA', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' MAD';
}

// Format date in Moroccan format
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Format datetime
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format hours (e.g. 7.5 → "7h30")
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

// IMEI Luhn validation
export function validateIMEI(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false;

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(imei[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

// Generate WhatsApp link
export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const phoneWithCountry = cleanPhone.startsWith('212') ? cleanPhone : `212${cleanPhone.replace(/^0/, '')}`;
  return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
}

// Generate a unique gift card code (8 chars alphanumeric uppercase)
export function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate a PO number (e.g. PO-2026-0001)
export function generatePONumber(sequence: number): string {
  const year = new Date().getFullYear();
  return `PO-${year}-${sequence.toString().padStart(4, '0')}`;
}

// Condition labels in French
export const conditionLabels: Record<string, string> = {
  new: 'Neuf',
  like_new: 'Comme neuf',
  good: 'Bon état',
  fair: 'État correct',
  poor: 'Mauvais état',
};

// Status labels in French
export const statusLabels: Record<string, string> = {
  in_stock: 'En stock',
  sold: 'Vendu',
  in_repair: 'En réparation',
  transferred: 'Transféré',
  returned: 'Retourné',
};

// Repair status labels
export const repairStatusLabels: Record<string, string> = {
  received: 'Reçu',
  diagnosing: 'Diagnostic',
  waiting_parts: 'Attente pièces',
  in_repair: 'En réparation',
  ready: 'Prêt',
  delivered: 'Livré',
  cancelled: 'Annulé',
};

// Status colors
export const statusColors: Record<string, string> = {
  in_stock: 'bg-green-500',
  sold: 'bg-blue-500',
  in_repair: 'bg-yellow-500',
  transferred: 'bg-purple-500',
  returned: 'bg-red-500',
};

// Repair status colors
export const repairStatusColors: Record<string, string> = {
  received: 'bg-gray-500',
  diagnosing: 'bg-blue-500',
  waiting_parts: 'bg-yellow-500',
  in_repair: 'bg-orange-500',
  ready: 'bg-green-500',
  delivered: 'bg-emerald-600',
  cancelled: 'bg-red-500',
};

// Valid repair status transitions
export const validRepairTransitions: Record<string, string[]> = {
  received: ['diagnosing', 'cancelled'],
  diagnosing: ['waiting_parts', 'in_repair', 'cancelled'],
  waiting_parts: ['in_repair', 'cancelled'],
  in_repair: ['ready', 'waiting_parts', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

// ============================================================
// NEW FEATURE LABELS
// ============================================================

// Trade-in status labels
export const tradeInStatusLabels: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Accepté',
  rejected: 'Refusé',
  in_refurbishment: 'En remise à neuf',
  listed: 'Mis en vente',
  sold: 'Vendu',
};

export const tradeInStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  accepted: 'bg-blue-500',
  rejected: 'bg-red-500',
  in_refurbishment: 'bg-orange-500',
  listed: 'bg-green-500',
  sold: 'bg-emerald-600',
};

// Return type labels
export const returnTypeLabels: Record<string, string> = {
  full: 'Retour complet',
  partial: 'Retour partiel',
  exchange: 'Échange',
};

export const returnReasonLabels: Record<string, string> = {
  defective: 'Défectueux',
  wrong_item: 'Mauvais article',
  customer_changed_mind: 'Changement d\'avis',
  warranty: 'Garantie',
  other: 'Autre',
};

export const refundMethodLabels: Record<string, string> = {
  cash: 'Espèces',
  card: 'Carte',
  store_credit: 'Avoir magasin',
  exchange: 'Échange',
};

// Cash movement labels
export const cashMovementLabels: Record<string, string> = {
  sale: 'Vente',
  return: 'Retour',
  expense: 'Dépense',
  deposit: 'Dépôt',
  withdrawal: 'Retrait',
  adjustment: 'Ajustement',
};

export const cashMovementColors: Record<string, string> = {
  sale: 'text-green-600',
  return: 'text-red-600',
  expense: 'text-red-500',
  deposit: 'text-blue-600',
  withdrawal: 'text-orange-500',
  adjustment: 'text-gray-600',
};

// Installment status labels
export const installmentStatusLabels: Record<string, string> = {
  active: 'En cours',
  completed: 'Terminé',
  defaulted: 'Impayé',
  cancelled: 'Annulé',
};

export const installmentStatusColors: Record<string, string> = {
  active: 'bg-blue-500',
  completed: 'bg-green-500',
  defaulted: 'bg-red-500',
  cancelled: 'bg-gray-500',
};

// Gift card status labels
export const giftCardStatusLabels: Record<string, string> = {
  active: 'Active',
  used: 'Utilisée',
  expired: 'Expirée',
  cancelled: 'Annulée',
};

// Loyalty tier labels
export const loyaltyTierLabels: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Argent',
  gold: 'Or',
  platinum: 'Platine',
};

export const loyaltyTierColors: Record<string, string> = {
  bronze: 'text-amber-700 bg-amber-100',
  silver: 'text-gray-600 bg-gray-100',
  gold: 'text-yellow-700 bg-yellow-100',
  platinum: 'text-purple-700 bg-purple-100',
};

// Commission status labels
export const commissionStatusLabels: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  paid: 'Payée',
  cancelled: 'Annulée',
};

// PO status labels
export const poStatusLabels: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  partial: 'Partiel',
  received: 'Reçu',
  cancelled: 'Annulé',
};

export const poStatusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  sent: 'bg-blue-500',
  partial: 'bg-yellow-500',
  received: 'bg-green-500',
  cancelled: 'bg-red-500',
};

// Part category labels
export const partCategoryLabels: Record<string, string> = {
  screen: 'Écran',
  battery: 'Batterie',
  charging_port: 'Port de charge',
  camera: 'Caméra',
  speaker: 'Haut-parleur',
  microphone: 'Microphone',
  button: 'Bouton',
  housing: 'Coque/Châssis',
  motherboard: 'Carte mère',
  other: 'Autre',
};

// Alert type labels
export const alertTypeLabels: Record<string, string> = {
  low_stock: 'Stock bas',
  aging_stock: 'Stock ancien',
  negative_margin: 'Marge négative',
  warranty_expiring: 'Garantie expirante',
};

// Payment method labels (expanded)
export const paymentMethodLabels: Record<string, string> = {
  cash: 'Espèces',
  card: 'Carte',
  virement: 'Virement',
  mixte: 'Mixte',
  store_credit: 'Avoir',
  gift_card: 'Carte cadeau',
  installment: 'Paiement échelonné',
};

// Notification type icons
export const notificationTypeIcons: Record<string, string> = {
  repair_ready: '🔧',
  transfer_received: '📦',
  low_stock: '⚠️',
  sale_made: '💰',
  return_processed: '↩️',
  warranty_expiring: '🛡️',
  payment_due: '💳',
  stock_alert: '📊',
  repair_reminder: '⏰',
  commission_update: '💵',
  trade_in_received: '📱',
  whatsapp_sent: '💬',
  cash_session: '🏦',
  installment_due: '📅',
  gift_card_received: '🎁',
};
