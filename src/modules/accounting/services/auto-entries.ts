import { createJournalEntry, JournalLineInput } from './journal-service';

// ─── Types for incoming events ──────────────────────────────────────────────

export interface SaleEvent {
  id: string;
  orgId: string;
  storeId: string;
  total: number;
  paymentMethod: 'cash' | 'card' | 'virement' | 'mixte';
  paymentDetails?: Record<string, number>;
  createdBy: string;
  date: string; // YYYY-MM-DD
}

export interface POReceivedEvent {
  id: string;
  orgId: string;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  createdBy: string;
  date: string;
}

export interface RepairCompletedEvent {
  id: string;
  orgId: string;
  finalCost: number;
  paymentMethod: 'cash' | 'card' | 'virement';
  customerId?: string;
  createdBy: string;
  date: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_TVA_RATE = 20; // 20% default

function computeHT(ttc: number, tvaRate: number): number {
  return Math.round((ttc / (1 + tvaRate / 100)) * 100) / 100;
}

function computeTVA(ttc: number, ht: number): number {
  return Math.round((ttc - ht) * 100) / 100;
}

// ─── Sale Completed ─────────────────────────────────────────────────────────

export async function handleSaleCompleted(sale: SaleEvent) {
  const ht = computeHT(sale.total, DEFAULT_TVA_RATE);
  const tva = computeTVA(sale.total, ht);

  const lines: JournalLineInput[] = [];

  // Debit: cash or bank depending on payment method
  if (sale.paymentMethod === 'mixte' && sale.paymentDetails) {
    // Split across payment methods
    const cashAmount = (sale.paymentDetails.cash || 0);
    const nonCashAmount = sale.total - cashAmount;

    if (cashAmount > 0) {
      lines.push({ accountCode: '5161', debit: cashAmount, credit: 0, label: 'Encaissement especes' });
    }
    if (nonCashAmount > 0) {
      lines.push({ accountCode: '5141', debit: nonCashAmount, credit: 0, label: 'Encaissement banque' });
    }
  } else if (sale.paymentMethod === 'cash') {
    lines.push({ accountCode: '5161', debit: sale.total, credit: 0, label: 'Encaissement especes' });
  } else {
    // card, virement -> banque
    lines.push({ accountCode: '5141', debit: sale.total, credit: 0, label: 'Encaissement banque' });
  }

  // Credit: ventes HT
  lines.push({ accountCode: '7111', debit: 0, credit: ht, label: 'Ventes marchandises HT' });

  // Credit: TVA collectee
  if (tva > 0) {
    lines.push({ accountCode: '4455', debit: 0, credit: tva, label: 'TVA collectee 20%' });
  }

  return createJournalEntry({
    orgId: sale.orgId,
    journalCode: sale.paymentMethod === 'cash' ? 'CA' : 'BQ',
    date: sale.date,
    label: `Vente ${sale.id}`,
    lines,
    createdBy: sale.createdBy,
    sourceEventId: sale.id,
  });
}

// ─── PO Received ────────────────────────────────────────────────────────────

export async function handlePOReceived(po: POReceivedEvent) {
  const lines: JournalLineInput[] = [
    { accountCode: '6111', debit: po.totalHT, credit: 0, label: 'Achats marchandises HT' },
  ];

  if (po.totalTVA > 0) {
    lines.push({ accountCode: '3455', debit: po.totalTVA, credit: 0, label: 'TVA deductible' });
  }

  lines.push({ accountCode: '4111', debit: 0, credit: po.totalTTC, label: 'Fournisseurs' });

  return createJournalEntry({
    orgId: po.orgId,
    journalCode: 'AC',
    date: po.date,
    label: `Reception commande ${po.id}`,
    lines,
    createdBy: po.createdBy,
    sourceEventId: po.id,
  });
}

// ─── Repair Completed ───────────────────────────────────────────────────────

export async function handleRepairCompleted(repair: RepairCompletedEvent) {
  const ht = computeHT(repair.finalCost, DEFAULT_TVA_RATE);
  const tva = computeTVA(repair.finalCost, ht);

  const lines: JournalLineInput[] = [];

  // Debit: cash or bank
  if (repair.paymentMethod === 'cash') {
    lines.push({ accountCode: '5161', debit: repair.finalCost, credit: 0, label: 'Encaissement reparation especes' });
  } else {
    lines.push({ accountCode: '5141', debit: repair.finalCost, credit: 0, label: 'Encaissement reparation banque' });
  }

  // Credit: prestations HT
  lines.push({ accountCode: '7127', debit: 0, credit: ht, label: 'Prestations services HT' });

  // Credit: TVA
  if (tva > 0) {
    lines.push({ accountCode: '4455', debit: 0, credit: tva, label: 'TVA collectee 20%' });
  }

  return createJournalEntry({
    orgId: repair.orgId,
    journalCode: repair.paymentMethod === 'cash' ? 'CA' : 'BQ',
    date: repair.date,
    label: `Reparation ${repair.id}`,
    lines,
    createdBy: repair.createdBy,
    sourceEventId: repair.id,
  });
}
