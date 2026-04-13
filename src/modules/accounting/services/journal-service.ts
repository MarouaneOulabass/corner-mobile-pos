import { createServiceClient } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface JournalLineInput {
  accountCode: string;
  debit: number;
  credit: number;
  label?: string;
}

export interface CreateJournalEntryParams {
  orgId: string;
  journalCode: string;
  date: string; // YYYY-MM-DD
  label: string;
  lines: JournalLineInput[];
  createdBy: string;
  sourceEventId?: string;
}

export interface JournalEntryFilters {
  journalCode?: string;
  dateFrom?: string;
  dateTo?: string;
  accountCode?: string;
}

export interface LedgerLine {
  id: string;
  entry_id: string;
  entry_number: string;
  date: string;
  entry_label: string;
  line_label: string | null;
  debit: number;
  credit: number;
  running_balance: number;
}

export interface TrialBalanceRow {
  account_code: string;
  account_label: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

// ─── Chart of Accounts ──────────────────────────────────────────────────────

export async function getChartOfAccounts(orgId: string) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('organization_id', orgId)
    .order('code', { ascending: true });

  if (error) throw new Error(`Failed to fetch chart of accounts: ${error.message}`);
  return data || [];
}

// ─── Create Journal Entry ───────────────────────────────────────────────────

export async function createJournalEntry(params: CreateJournalEntryParams) {
  const { orgId, journalCode, date, label, lines, createdBy, sourceEventId } = params;
  const supabase = createServiceClient();

  // Validate: at least 2 lines
  if (!lines || lines.length < 2) {
    throw new Error('A journal entry must have at least 2 lines');
  }

  // Validate: debit = credit
  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Entry is unbalanced: total debit (${totalDebit.toFixed(2)}) != total credit (${totalCredit.toFixed(2)})`
    );
  }

  // Validate: each line has either debit or credit > 0 (not both)
  for (const line of lines) {
    if (line.debit < 0 || line.credit < 0) {
      throw new Error('Debit and credit amounts must be >= 0');
    }
    if (line.debit === 0 && line.credit === 0) {
      throw new Error('Each line must have a non-zero debit or credit');
    }
  }

  // Resolve journal id from code
  const { data: journal, error: jErr } = await supabase
    .from('journals')
    .select('id, code')
    .eq('organization_id', orgId)
    .eq('code', journalCode)
    .single();

  if (jErr || !journal) {
    throw new Error(`Journal '${journalCode}' not found for this organization`);
  }

  // Generate entry_number: JournalCode-YYYY-NNNNNN
  const year = date.substring(0, 4);
  const prefix = `${journalCode}-${year}-`;

  // Count existing entries with this prefix to determine next number
  const { count, error: countErr } = await supabase
    .from('journal_entries')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .like('entry_number', `${prefix}%`);

  if (countErr) throw new Error(`Failed to generate entry number: ${countErr.message}`);

  const nextNum = ((count || 0) + 1).toString().padStart(6, '0');
  const entryNumber = `${prefix}${nextNum}`;

  // Validate account codes exist
  const accountCodes = Array.from(new Set(lines.map(l => l.accountCode)));
  const { data: accounts, error: accErr } = await supabase
    .from('chart_of_accounts')
    .select('code')
    .eq('organization_id', orgId)
    .in('code', accountCodes);

  if (accErr) throw new Error(`Failed to validate accounts: ${accErr.message}`);

  const foundCodes = new Set((accounts || []).map(a => a.code));
  const missing = accountCodes.filter(c => !foundCodes.has(c));
  if (missing.length > 0) {
    throw new Error(`Unknown account codes: ${missing.join(', ')}`);
  }

  // Insert journal entry
  const { data: entry, error: entryErr } = await supabase
    .from('journal_entries')
    .insert({
      organization_id: orgId,
      journal_id: journal.id,
      entry_number: entryNumber,
      date,
      label,
      source_event_id: sourceEventId || null,
      created_by: createdBy,
    })
    .select('*')
    .single();

  if (entryErr) throw new Error(`Failed to create journal entry: ${entryErr.message}`);

  // Insert journal lines
  const lineRows = lines.map(l => ({
    entry_id: entry.id,
    account_code: l.accountCode,
    debit: l.debit,
    credit: l.credit,
    label: l.label || null,
  }));

  const { data: insertedLines, error: linesErr } = await supabase
    .from('journal_lines')
    .insert(lineRows)
    .select('*');

  if (linesErr) {
    // Rollback entry
    await supabase.from('journal_entries').delete().eq('id', entry.id);
    throw new Error(`Failed to create journal lines: ${linesErr.message}`);
  }

  return { ...entry, lines: insertedLines };
}

// ─── Validate Journal Entry ─────────────────────────────────────────────────

export async function validateJournalEntry(entryId: string, validatedBy: string) {
  const supabase = createServiceClient();

  // Check entry exists and is not already locked
  const { data: entry, error: fetchErr } = await supabase
    .from('journal_entries')
    .select('id, locked')
    .eq('id', entryId)
    .single();

  if (fetchErr || !entry) throw new Error('Journal entry not found');
  if (entry.locked) throw new Error('Journal entry is already locked');

  const { data: updated, error: updateErr } = await supabase
    .from('journal_entries')
    .update({
      validated_by: validatedBy,
      validated_at: new Date().toISOString(),
      locked: true,
    })
    .eq('id', entryId)
    .select('*')
    .single();

  if (updateErr) throw new Error(`Failed to validate entry: ${updateErr.message}`);
  return updated;
}

// ─── Get Journal Entries ────────────────────────────────────────────────────

export async function getJournalEntries(orgId: string, filters: JournalEntryFilters = {}) {
  const supabase = createServiceClient();

  let query = supabase
    .from('journal_entries')
    .select('*, journal:journals(id, code, label), lines:journal_lines(*), creator:users!journal_entries_created_by_fkey(id, name), validator:users!journal_entries_validated_by_fkey(id, name)')
    .eq('organization_id', orgId)
    .order('date', { ascending: false });

  if (filters.journalCode) {
    // Need to filter by journal code via subquery
    const { data: j } = await supabase
      .from('journals')
      .select('id')
      .eq('organization_id', orgId)
      .eq('code', filters.journalCode)
      .single();

    if (j) {
      query = query.eq('journal_id', j.id);
    }
  }

  if (filters.dateFrom) {
    query = query.gte('date', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('date', filters.dateTo);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch journal entries: ${error.message}`);

  let entries = data || [];

  // Filter by account code if specified (post-filter since lines are nested)
  if (filters.accountCode) {
    entries = entries.filter((e: Record<string, unknown>) => {
      const lines = e.lines as Array<{ account_code: string }> | undefined;
      return lines?.some(l => l.account_code === filters.accountCode);
    });
  }

  return entries;
}

// ─── Get Ledger (Grand Livre) ───────────────────────────────────────────────

export async function getLedger(
  orgId: string,
  accountCode: string,
  dateFrom?: string,
  dateTo?: string
): Promise<LedgerLine[]> {
  const supabase = createServiceClient();

  // Fetch all journal lines for this account, joined with their entries
  let query = supabase
    .from('journal_lines')
    .select('id, entry_id, debit, credit, label, entry:journal_entries!inner(id, entry_number, date, label, organization_id)')
    .eq('account_code', accountCode)
    .eq('entry.organization_id', orgId);

  if (dateFrom) {
    query = query.gte('entry.date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('entry.date', dateTo);
  }

  query = query.order('entry(date)', { ascending: true });

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch ledger: ${error.message}`);

  // Build ledger with running balance
  let runningBalance = 0;
  const ledgerLines: LedgerLine[] = (data || []).map((row: Record<string, unknown>) => {
    const entry = row.entry as Record<string, unknown>;
    const debit = Number(row.debit) || 0;
    const credit = Number(row.credit) || 0;
    runningBalance += debit - credit;

    return {
      id: row.id as string,
      entry_id: row.entry_id as string,
      entry_number: entry.entry_number as string,
      date: entry.date as string,
      entry_label: entry.label as string,
      line_label: row.label as string | null,
      debit,
      credit,
      running_balance: Math.round(runningBalance * 100) / 100,
    };
  });

  return ledgerLines;
}

// ─── Get Trial Balance (Balance) ────────────────────────────────────────────

export async function getTrialBalance(orgId: string, asOfDate: string): Promise<TrialBalanceRow[]> {
  const supabase = createServiceClient();

  // Fetch all journal lines up to asOfDate, joined with entries for org/date filtering
  const { data, error } = await supabase
    .from('journal_lines')
    .select('account_code, debit, credit, entry:journal_entries!inner(organization_id, date)')
    .eq('entry.organization_id', orgId)
    .lte('entry.date', asOfDate);

  if (error) throw new Error(`Failed to compute trial balance: ${error.message}`);

  // Aggregate by account_code
  const accountMap = new Map<string, { totalDebit: number; totalCredit: number }>();

  for (const row of data || []) {
    const code = row.account_code;
    const existing = accountMap.get(code) || { totalDebit: 0, totalCredit: 0 };
    existing.totalDebit += Number(row.debit) || 0;
    existing.totalCredit += Number(row.credit) || 0;
    accountMap.set(code, existing);
  }

  // Fetch account labels
  const codes = Array.from(accountMap.keys());
  if (codes.length === 0) return [];

  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('code, label')
    .eq('organization_id', orgId)
    .in('code', codes);

  const labelMap = new Map((accounts || []).map(a => [a.code, a.label]));

  const rows: TrialBalanceRow[] = codes
    .sort()
    .map(code => {
      const agg = accountMap.get(code)!;
      return {
        account_code: code,
        account_label: labelMap.get(code) || code,
        total_debit: Math.round(agg.totalDebit * 100) / 100,
        total_credit: Math.round(agg.totalCredit * 100) / 100,
        balance: Math.round((agg.totalDebit - agg.totalCredit) * 100) / 100,
      };
    });

  return rows;
}
