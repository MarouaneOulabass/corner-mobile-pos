import { createServiceClient } from '@/lib/supabase';

// ─── CSV Export ─────────────────────────────────────────────────────────────

export async function exportToCSV(
  orgId: string,
  journalCode: string,
  dateFrom: string,
  dateTo: string
): Promise<string> {
  const supabase = createServiceClient();

  // Resolve journal id
  const { data: journal } = await supabase
    .from('journals')
    .select('id, code, label')
    .eq('organization_id', orgId)
    .eq('code', journalCode)
    .single();

  if (!journal) throw new Error(`Journal '${journalCode}' not found`);

  // Fetch entries with lines
  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('*, lines:journal_lines(*)')
    .eq('organization_id', orgId)
    .eq('journal_id', journal.id)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: true });

  if (error) throw new Error(`Failed to fetch entries for export: ${error.message}`);

  // Build CSV
  const header = 'Journal,Numero,Date,Libelle,Compte,Debit,Credit,Libelle_Ligne';
  const rows: string[] = [header];

  for (const entry of entries || []) {
    const lines = (entry.lines || []) as Array<{
      account_code: string;
      debit: number;
      credit: number;
      label: string | null;
    }>;
    for (const line of lines) {
      rows.push([
        escapeCsvField(journal.code),
        escapeCsvField(entry.entry_number),
        entry.date,
        escapeCsvField(entry.label || ''),
        line.account_code,
        Number(line.debit).toFixed(2),
        Number(line.credit).toFixed(2),
        escapeCsvField(line.label || ''),
      ].join(','));
    }
  }

  return rows.join('\n');
}

// ─── Sage Export (pipe-delimited) ───────────────────────────────────────────

export async function exportSageFormat(
  orgId: string,
  dateFrom: string,
  dateTo: string
): Promise<string> {
  const supabase = createServiceClient();

  // Fetch all entries with lines across all journals
  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('*, journal:journals(code), lines:journal_lines(*)')
    .eq('organization_id', orgId)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: true });

  if (error) throw new Error(`Failed to fetch entries for Sage export: ${error.message}`);

  // Sage format: pipe-delimited
  // Format: JournalCode|Date(DDMMYYYY)|CompteGeneral|CompteAux|Libelle|Debit|Credit|NumPiece
  const rows: string[] = [];

  for (const entry of entries || []) {
    const journal = entry.journal as { code: string } | null;
    const journalCode = journal?.code || '';
    // Convert date YYYY-MM-DD to DDMMYYYY
    const [y, m, d] = (entry.date as string).split('-');
    const sageDate = `${d}${m}${y}`;

    const lines = (entry.lines || []) as Array<{
      account_code: string;
      debit: number;
      credit: number;
      label: string | null;
    }>;
    for (const line of lines) {
      rows.push([
        journalCode,
        sageDate,
        line.account_code,
        '', // compte auxiliaire (empty)
        (line.label || entry.label || '').replace(/\|/g, ' '),
        Number(line.debit).toFixed(2),
        Number(line.credit).toFixed(2),
        entry.entry_number,
      ].join('|'));
    }
  }

  return rows.join('\n');
}

// ─── Number to French Words ─────────────────────────────────────────────────

const UNITS_FR = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];

const TENS_FR = [
  '', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante',
  'soixante', 'quatre-vingt', 'quatre-vingt',
];

function convertChunkFR(n: number): string {
  if (n === 0) return '';
  if (n < 20) return UNITS_FR[n];

  if (n < 100) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;

    // Special French counting: 70-79, 90-99
    if (ten === 7 || ten === 9) {
      const base = TENS_FR[ten];
      const remainder = (ten === 7 ? 10 : 10) + unit;
      if (remainder === 10) return `${base}-dix`;
      if (remainder === 11) return `${base}-et-onze`;
      return `${base}-${UNITS_FR[remainder]}`;
    }

    if (unit === 0) {
      return ten === 8 ? 'quatre-vingts' : TENS_FR[ten];
    }
    if (unit === 1 && ten !== 8) {
      return `${TENS_FR[ten]} et un`;
    }
    return `${TENS_FR[ten]}-${UNITS_FR[unit]}`;
  }

  if (n < 1000) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let prefix = hundred === 1 ? 'cent' : `${UNITS_FR[hundred]} cent`;
    if (rest === 0 && hundred > 1) prefix += 's';
    if (rest > 0) prefix += ` ${convertChunkFR(rest)}`;
    return prefix;
  }

  return '';
}

export function numberToWordsFR(amount: number): string {
  if (amount === 0) return 'zero dirham';

  const whole = Math.floor(Math.abs(amount));
  const cents = Math.round((Math.abs(amount) - whole) * 100);

  let result = '';

  if (whole === 0) {
    result = 'zero';
  } else if (whole < 1000) {
    result = convertChunkFR(whole);
  } else if (whole < 1000000) {
    const thousands = Math.floor(whole / 1000);
    const rest = whole % 1000;
    if (thousands === 1) {
      result = 'mille';
    } else {
      result = `${convertChunkFR(thousands)} mille`;
    }
    if (rest > 0) result += ` ${convertChunkFR(rest)}`;
  } else {
    const millions = Math.floor(whole / 1000000);
    const rest = whole % 1000000;
    result = `${convertChunkFR(millions)} million${millions > 1 ? 's' : ''}`;
    if (rest > 0) {
      const thousands = Math.floor(rest / 1000);
      const remainder = rest % 1000;
      if (thousands > 0) {
        result += thousands === 1 ? ' mille' : ` ${convertChunkFR(thousands)} mille`;
      }
      if (remainder > 0) result += ` ${convertChunkFR(remainder)}`;
    }
  }

  result += whole === 1 ? ' dirham' : ' dirhams';

  if (cents > 0) {
    result += ` et ${convertChunkFR(cents)} centime${cents > 1 ? 's' : ''}`;
  }

  return result.trim();
}

// ─── Number to Arabic Words (Basic) ─────────────────────────────────────────

const UNITS_AR = [
  '', '\u0648\u0627\u062d\u062f', '\u0627\u062b\u0646\u0627\u0646', '\u062b\u0644\u0627\u062b\u0629', '\u0623\u0631\u0628\u0639\u0629', '\u062e\u0645\u0633\u0629', '\u0633\u062a\u0629', '\u0633\u0628\u0639\u0629', '\u062b\u0645\u0627\u0646\u064a\u0629', '\u062a\u0633\u0639\u0629',
  '\u0639\u0634\u0631\u0629', '\u0623\u062d\u062f \u0639\u0634\u0631', '\u0627\u062b\u0646\u0627 \u0639\u0634\u0631', '\u062b\u0644\u0627\u062b\u0629 \u0639\u0634\u0631', '\u0623\u0631\u0628\u0639\u0629 \u0639\u0634\u0631', '\u062e\u0645\u0633\u0629 \u0639\u0634\u0631', '\u0633\u062a\u0629 \u0639\u0634\u0631',
  '\u0633\u0628\u0639\u0629 \u0639\u0634\u0631', '\u062b\u0645\u0627\u0646\u064a\u0629 \u0639\u0634\u0631', '\u062a\u0633\u0639\u0629 \u0639\u0634\u0631',
];

const TENS_AR = [
  '', '', '\u0639\u0634\u0631\u0648\u0646', '\u062b\u0644\u0627\u062b\u0648\u0646', '\u0623\u0631\u0628\u0639\u0648\u0646', '\u062e\u0645\u0633\u0648\u0646', '\u0633\u062a\u0648\u0646', '\u0633\u0628\u0639\u0648\u0646', '\u062b\u0645\u0627\u0646\u0648\u0646', '\u062a\u0633\u0639\u0648\u0646',
];

function convertChunkAR(n: number): string {
  if (n === 0) return '';
  if (n < 20) return UNITS_AR[n];

  if (n < 100) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    if (unit === 0) return TENS_AR[ten];
    return `${UNITS_AR[unit]} \u0648${TENS_AR[ten]}`;
  }

  if (n < 1000) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let prefix = hundred === 1 ? '\u0645\u0627\u0626\u0629' : hundred === 2 ? '\u0645\u0627\u0626\u062a\u0627\u0646' : `${UNITS_AR[hundred]} \u0645\u0627\u0626\u0629`;
    if (rest > 0) prefix += ` \u0648${convertChunkAR(rest)}`;
    return prefix;
  }

  return '';
}

export function numberToWordsAR(amount: number): string {
  if (amount === 0) return '\u0635\u0641\u0631 \u062f\u0631\u0647\u0645';

  const whole = Math.floor(Math.abs(amount));
  const cents = Math.round((Math.abs(amount) - whole) * 100);

  let result = '';

  if (whole === 0) {
    result = '\u0635\u0641\u0631';
  } else if (whole < 1000) {
    result = convertChunkAR(whole);
  } else if (whole < 1000000) {
    const thousands = Math.floor(whole / 1000);
    const rest = whole % 1000;
    if (thousands === 1) {
      result = '\u0623\u0644\u0641';
    } else if (thousands === 2) {
      result = '\u0623\u0644\u0641\u0627\u0646';
    } else {
      result = `${convertChunkAR(thousands)} \u0622\u0644\u0627\u0641`;
    }
    if (rest > 0) result += ` \u0648${convertChunkAR(rest)}`;
  } else {
    const millions = Math.floor(whole / 1000000);
    const rest = whole % 1000000;
    result = millions === 1 ? '\u0645\u0644\u064a\u0648\u0646' : `${convertChunkAR(millions)} \u0645\u0644\u0627\u064a\u064a\u0646`;
    if (rest > 0) {
      const thousands = Math.floor(rest / 1000);
      const remainder = rest % 1000;
      if (thousands > 0) {
        if (thousands === 1) result += ' \u0648\u0623\u0644\u0641';
        else if (thousands === 2) result += ' \u0648\u0623\u0644\u0641\u0627\u0646';
        else result += ` \u0648${convertChunkAR(thousands)} \u0622\u0644\u0627\u0641`;
      }
      if (remainder > 0) result += ` \u0648${convertChunkAR(remainder)}`;
    }
  }

  result += ' \u062f\u0631\u0647\u0645';

  if (cents > 0) {
    result += ` \u0648${convertChunkAR(cents)} \u0633\u0646\u062a\u064a\u0645`;
  }

  return result.trim();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
