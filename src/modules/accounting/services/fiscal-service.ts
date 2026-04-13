import { createServiceClient } from '@/lib/supabase';

// ─── Get Fiscal Periods ─────────────────────────────────────────────────────

export async function getFiscalPeriods(orgId: string, year?: number) {
  const supabase = createServiceClient();

  let query = supabase
    .from('fiscal_periods')
    .select('*')
    .eq('organization_id', orgId)
    .order('year', { ascending: true })
    .order('month', { ascending: true });

  if (year) {
    query = query.eq('year', year);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch fiscal periods: ${error.message}`);
  return data || [];
}

// ─── Close Fiscal Period ────────────────────────────────────────────────────

export async function closeFiscalPeriod(
  orgId: string,
  year: number,
  month: number,
  closedBy: string
) {
  const supabase = createServiceClient();

  // 1. Find the fiscal period
  const { data: period, error: periodErr } = await supabase
    .from('fiscal_periods')
    .select('*')
    .eq('organization_id', orgId)
    .eq('year', year)
    .eq('month', month)
    .single();

  if (periodErr || !period) {
    throw new Error(`Fiscal period ${year}-${String(month).padStart(2, '0')} not found`);
  }

  if (period.status === 'closed') {
    throw new Error('Fiscal period is already closed');
  }

  // 2. Check all journal entries in this period are validated/locked
  const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
  // End date: last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: unlockedEntries, error: checkErr } = await supabase
    .from('journal_entries')
    .select('id, entry_number', { count: 'exact' })
    .eq('organization_id', orgId)
    .gte('date', periodStart)
    .lte('date', periodEnd)
    .eq('locked', false);

  if (checkErr) throw new Error(`Failed to check entries: ${checkErr.message}`);

  if (unlockedEntries && unlockedEntries.length > 0) {
    throw new Error(
      `Cannot close period: ${unlockedEntries.length} journal entries are not yet validated/locked. ` +
      `First unlocked: ${unlockedEntries[0].entry_number}`
    );
  }

  // 3. Close the period
  const { data: closed, error: closeErr } = await supabase
    .from('fiscal_periods')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: closedBy,
    })
    .eq('id', period.id)
    .select('*')
    .single();

  if (closeErr) throw new Error(`Failed to close fiscal period: ${closeErr.message}`);
  return closed;
}
