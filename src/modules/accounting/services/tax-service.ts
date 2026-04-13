import { createServiceClient } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VATDeclaration {
  id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  vat_collected_total: number;
  vat_deductible_total: number;
  vat_due: number;
  status: string;
  generated_at: string | null;
}

// ─── Get Tax Rates ──────────────────────────────────────────────────────────

export async function getTaxRates(orgId: string) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('tax_rates')
    .select('*')
    .eq('organization_id', orgId)
    .order('code', { ascending: true });

  if (error) throw new Error(`Failed to fetch tax rates: ${error.message}`);
  return data || [];
}

// ─── Generate VAT Declaration ───────────────────────────────────────────────

export async function generateVATDeclaration(
  orgId: string,
  periodStart: string,
  periodEnd: string
): Promise<VATDeclaration> {
  const supabase = createServiceClient();

  // Sum TVA collectee: credit on account 4455 (within period)
  const { data: collectedLines, error: collErr } = await supabase
    .from('journal_lines')
    .select('credit, entry:journal_entries!inner(organization_id, date)')
    .eq('account_code', '4455')
    .eq('entry.organization_id', orgId)
    .gte('entry.date', periodStart)
    .lte('entry.date', periodEnd);

  if (collErr) throw new Error(`Failed to compute TVA collectee: ${collErr.message}`);

  const vatCollected = (collectedLines || []).reduce(
    (sum, row) => sum + (Number(row.credit) || 0),
    0
  );

  // Sum TVA recuperable: debit on account 3455 (within period)
  const { data: deductibleLines, error: dedErr } = await supabase
    .from('journal_lines')
    .select('debit, entry:journal_entries!inner(organization_id, date)')
    .eq('account_code', '3455')
    .eq('entry.organization_id', orgId)
    .gte('entry.date', periodStart)
    .lte('entry.date', periodEnd);

  if (dedErr) throw new Error(`Failed to compute TVA deductible: ${dedErr.message}`);

  const vatDeductible = (deductibleLines || []).reduce(
    (sum, row) => sum + (Number(row.debit) || 0),
    0
  );

  const vatDue = Math.round((vatCollected - vatDeductible) * 100) / 100;

  // Upsert tax declaration
  const { data: existing } = await supabase
    .from('tax_declarations')
    .select('id')
    .eq('organization_id', orgId)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .maybeSingle();

  if (existing) {
    // Update
    const { data: updated, error: updErr } = await supabase
      .from('tax_declarations')
      .update({
        vat_collected_total: Math.round(vatCollected * 100) / 100,
        vat_deductible_total: Math.round(vatDeductible * 100) / 100,
        vat_due: vatDue,
        status: 'generated',
        generated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (updErr) throw new Error(`Failed to update VAT declaration: ${updErr.message}`);
    return updated as VATDeclaration;
  } else {
    // Insert
    const { data: created, error: insErr } = await supabase
      .from('tax_declarations')
      .insert({
        organization_id: orgId,
        period_start: periodStart,
        period_end: periodEnd,
        vat_collected_total: Math.round(vatCollected * 100) / 100,
        vat_deductible_total: Math.round(vatDeductible * 100) / 100,
        vat_due: vatDue,
        status: 'generated',
        generated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (insErr) throw new Error(`Failed to create VAT declaration: ${insErr.message}`);
    return created as VATDeclaration;
  }
}

// ─── Get VAT Declaration ────────────────────────────────────────────────────

export async function getVATDeclaration(
  orgId: string,
  periodStart: string,
  periodEnd: string
): Promise<VATDeclaration | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('tax_declarations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch VAT declaration: ${error.message}`);
  return data as VATDeclaration | null;
}
