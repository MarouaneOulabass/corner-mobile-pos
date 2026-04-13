import { createServiceClient } from '@/lib/supabase';
import { createJournalEntry } from './journal-service';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InvoiceItemInput {
  label: string;
  qty: number;
  unitPriceHT: number;
  taxRateId: string;
}

export interface CreateInvoiceParams {
  orgId: string;
  storeId: string;
  saleId?: string;
  customerId: string;
  items: InvoiceItemInput[];
  iceClient?: string;
  dueDate?: string;
  createdBy: string;
}

export interface InvoiceFilters {
  storeId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  page?: number;
  limit?: number;
}

// ─── Generate Invoice Number ────────────────────────────────────────────────

export async function generateInvoiceNumber(orgId: string): Promise<string> {
  const supabase = createServiceClient();
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  // Count existing invoices with this prefix for the org
  const { count, error } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .like('invoice_number', `${prefix}%`);

  if (error) throw new Error(`Failed to generate invoice number: ${error.message}`);

  const nextNum = ((count || 0) + 1).toString().padStart(6, '0');
  return `${prefix}${nextNum}`;
}

// ─── Create Invoice ─────────────────────────────────────────────────────────

export async function createInvoice(params: CreateInvoiceParams) {
  const { orgId, storeId, saleId, customerId, items, iceClient, dueDate, createdBy } = params;
  const supabase = createServiceClient();

  if (!items || items.length === 0) {
    throw new Error('Invoice must have at least one item');
  }

  // Fetch tax rates for the items
  const taxRateIds = Array.from(new Set(items.map(i => i.taxRateId)));
  const { data: taxRates, error: taxErr } = await supabase
    .from('tax_rates')
    .select('id, rate, account_code')
    .eq('organization_id', orgId)
    .in('id', taxRateIds);

  if (taxErr) throw new Error(`Failed to fetch tax rates: ${taxErr.message}`);

  const taxRateMap = new Map((taxRates || []).map(t => [t.id, t]));

  // Validate all tax rate IDs exist
  for (const id of taxRateIds) {
    if (!taxRateMap.has(id)) {
      throw new Error(`Tax rate '${id}' not found`);
    }
  }

  // Calculate amounts per item
  let invoiceTotalHT = 0;
  let invoiceTotalTax = 0;

  const computedItems = items.map(item => {
    const taxRate = taxRateMap.get(item.taxRateId)!;
    const totalHT = Math.round(item.qty * item.unitPriceHT * 100) / 100;
    const totalTax = Math.round(totalHT * Number(taxRate.rate) / 100 * 100) / 100;

    invoiceTotalHT += totalHT;
    invoiceTotalTax += totalTax;

    return {
      label: item.label,
      quantity: item.qty,
      unit_price_ht: item.unitPriceHT,
      tax_rate_id: item.taxRateId,
      total_ht: totalHT,
      total_tax: totalTax,
    };
  });

  invoiceTotalHT = Math.round(invoiceTotalHT * 100) / 100;
  invoiceTotalTax = Math.round(invoiceTotalTax * 100) / 100;
  const invoiceTotalTTC = Math.round((invoiceTotalHT + invoiceTotalTax) * 100) / 100;

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber(orgId);

  // Insert invoice
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      organization_id: orgId,
      store_id: storeId,
      invoice_number: invoiceNumber,
      sale_id: saleId || null,
      customer_id: customerId,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: dueDate || null,
      total_ht: invoiceTotalHT,
      total_tax: invoiceTotalTax,
      total_ttc: invoiceTotalTTC,
      status: 'draft',
      ice_client: iceClient || null,
    })
    .select('*')
    .single();

  if (invErr) throw new Error(`Failed to create invoice: ${invErr.message}`);

  // Insert invoice items
  const itemRows = computedItems.map(ci => ({
    invoice_id: invoice.id,
    ...ci,
  }));

  const { data: insertedItems, error: itemsErr } = await supabase
    .from('invoice_items')
    .insert(itemRows)
    .select('*');

  if (itemsErr) {
    // Rollback invoice
    await supabase.from('invoices').delete().eq('id', invoice.id);
    throw new Error(`Failed to create invoice items: ${itemsErr.message}`);
  }

  // Generate journal entry: debit 3421 (clients), credit 7111 (ventes HT), credit 4455 (TVA)
  try {
    const journalLines = [
      { accountCode: '3421', debit: invoiceTotalTTC, credit: 0, label: `Facture ${invoiceNumber}` },
      { accountCode: '7111', debit: 0, credit: invoiceTotalHT, label: `Ventes HT - ${invoiceNumber}` },
    ];

    if (invoiceTotalTax > 0) {
      journalLines.push({
        accountCode: '4455',
        debit: 0,
        credit: invoiceTotalTax,
        label: `TVA collectee - ${invoiceNumber}`,
      });
    }

    await createJournalEntry({
      orgId,
      journalCode: 'VT',
      date: new Date().toISOString().split('T')[0],
      label: `Facture ${invoiceNumber}`,
      lines: journalLines,
      createdBy,
      sourceEventId: invoice.id,
    });
  } catch (err) {
    // Log but don't fail the invoice creation
    console.error('[Invoice] Failed to create journal entry:', err);
  }

  return { ...invoice, items: insertedItems };
}

// ─── Get Invoice ────────────────────────────────────────────────────────────

export async function getInvoice(invoiceId: string) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(*, tax_rate:tax_rates(id, code, label, rate)), customer:customers(id, name, phone, email)')
    .eq('id', invoiceId)
    .single();

  if (error) throw new Error(`Failed to fetch invoice: ${error.message}`);
  return data;
}

// ─── List Invoices ──────────────────────────────────────────────────────────

export async function listInvoices(orgId: string, filters: InvoiceFilters = {}) {
  const supabase = createServiceClient();
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('invoices')
    .select('*, customer:customers(id, name, phone)', { count: 'exact' })
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.storeId) query = query.eq('store_id', filters.storeId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.dateFrom) query = query.gte('issue_date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('issue_date', filters.dateTo);
  if (filters.customerId) query = query.eq('customer_id', filters.customerId);

  const { data, count, error } = await query;
  if (error) throw new Error(`Failed to list invoices: ${error.message}`);

  return { invoices: data || [], total: count || 0 };
}

// ─── Lock Invoice ───────────────────────────────────────────────────────────

export async function lockInvoice(invoiceId: string) {
  const supabase = createServiceClient();

  const { data: existing, error: fetchErr } = await supabase
    .from('invoices')
    .select('id, locked_at')
    .eq('id', invoiceId)
    .single();

  if (fetchErr || !existing) throw new Error('Invoice not found');
  if (existing.locked_at) throw new Error('Invoice is already locked');

  const { data, error } = await supabase
    .from('invoices')
    .update({
      locked_at: new Date().toISOString(),
      status: 'issued',
    })
    .eq('id', invoiceId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to lock invoice: ${error.message}`);
  return data;
}
