-- Corner Mobile — Migration 010: Accounting Module
--
-- Moroccan CGNC-compliant accounting with:
-- - Chart of accounts (plan comptable)
-- - Journals & journal entries (double-entry bookkeeping)
-- - Tax rates (TVA Morocco)
-- - Tax declarations
-- - Invoices & credit notes
-- - Fiscal period management
--
-- Fully idempotent: safe to re-run.

BEGIN;

-- ============================================================
-- SECTION 1: CHART OF ACCOUNTS
-- ============================================================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('class1','class2','class3','class4','class5','class6','class7')),
  parent_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- ============================================================
-- SECTION 2: JOURNALS
-- ============================================================

CREATE TABLE IF NOT EXISTS journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT CHECK (type IN ('sales','purchases','cash','bank','od','payroll')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- ============================================================
-- SECTION 3: JOURNAL ENTRIES
-- ============================================================

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  journal_id UUID NOT NULL REFERENCES journals(id),
  entry_number TEXT NOT NULL,
  date DATE NOT NULL,
  label TEXT,
  source_event_id UUID,
  created_by UUID REFERENCES users(id),
  validated_by UUID REFERENCES users(id),
  validated_at TIMESTAMPTZ,
  locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, entry_number)
);

-- ============================================================
-- SECTION 4: JOURNAL LINES
-- ============================================================

CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  debit NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit NUMERIC(15,2) NOT NULL DEFAULT 0,
  label TEXT,
  analytic_dimension JSONB,
  CHECK (debit >= 0 AND credit >= 0)
);

-- ============================================================
-- SECTION 5: TAX RATES
-- ============================================================

CREATE TABLE IF NOT EXISTS tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  rate NUMERIC(5,2) NOT NULL,
  type TEXT CHECK (type IN ('vat_collected','vat_deductible')),
  account_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- ============================================================
-- SECTION 6: TAX DECLARATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS tax_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  vat_collected_total NUMERIC(15,2),
  vat_deductible_total NUMERIC(15,2),
  vat_due NUMERIC(15,2),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','generated','submitted','paid')),
  generated_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SECTION 7: INVOICES
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  store_id UUID REFERENCES stores(id),
  invoice_number TEXT NOT NULL,
  sale_id UUID,
  customer_id UUID REFERENCES customers(id),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  total_ht NUMERIC(15,2) NOT NULL,
  total_tax NUMERIC(15,2) NOT NULL,
  total_ttc NUMERIC(15,2) NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','issued','sent','paid','cancelled')),
  pdf_url TEXT,
  qr_code_url TEXT,
  ice_client TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, invoice_number)
);

-- ============================================================
-- SECTION 8: INVOICE ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price_ht NUMERIC(15,2) NOT NULL,
  tax_rate_id UUID REFERENCES tax_rates(id),
  total_ht NUMERIC(15,2) NOT NULL,
  total_tax NUMERIC(15,2) NOT NULL
);

-- ============================================================
-- SECTION 9: CREDIT NOTES
-- ============================================================

CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  store_id UUID REFERENCES stores(id),
  credit_note_number TEXT NOT NULL,
  original_invoice_id UUID REFERENCES invoices(id),
  sale_id UUID,
  customer_id UUID REFERENCES customers(id),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  total_ht NUMERIC(15,2) NOT NULL,
  total_tax NUMERIC(15,2) NOT NULL,
  total_ttc NUMERIC(15,2) NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','issued','sent','paid','cancelled')),
  pdf_url TEXT,
  qr_code_url TEXT,
  ice_client TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, credit_note_number)
);

-- ============================================================
-- SECTION 10: FISCAL PERIODS
-- ============================================================

CREATE TABLE IF NOT EXISTS fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closing','closed')),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, year, month)
);

-- ============================================================
-- SECTION 11: INVOICE NUMBER SEQUENCE
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS invoice_seq_default START 1;

-- ============================================================
-- SECTION 12: INDEXES
-- ============================================================

-- Chart of accounts
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_org ON chart_of_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type ON chart_of_accounts(organization_id, type);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent ON chart_of_accounts(parent_id);

-- Journals
CREATE INDEX IF NOT EXISTS idx_journals_org ON journals(organization_id);

-- Journal entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_org ON journal_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_journal ON journal_entries(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_created_by ON journal_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_event_id);

-- Journal lines
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_code);

-- Tax rates
CREATE INDEX IF NOT EXISTS idx_tax_rates_org ON tax_rates(organization_id);

-- Tax declarations
CREATE INDEX IF NOT EXISTS idx_tax_declarations_org ON tax_declarations(organization_id);
CREATE INDEX IF NOT EXISTS idx_tax_declarations_period ON tax_declarations(organization_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_tax_declarations_status ON tax_declarations(status);
CREATE INDEX IF NOT EXISTS idx_tax_declarations_submitted_by ON tax_declarations(submitted_by);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_store ON invoices(organization_id, store_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_sale ON invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(organization_id, issue_date);

-- Invoice items
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_tax_rate ON invoice_items(tax_rate_id);

-- Credit notes
CREATE INDEX IF NOT EXISTS idx_credit_notes_org ON credit_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_org_store ON credit_notes(organization_id, store_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_original_invoice ON credit_notes(original_invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer ON credit_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON credit_notes(organization_id, status);

-- Fiscal periods
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_org ON fiscal_periods(organization_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_org_year ON fiscal_periods(organization_id, year);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_status ON fiscal_periods(organization_id, status);

-- ============================================================
-- SECTION 13: ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all accounting tables
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;

-- RLS Policies: org_id filtering via auth_org_id() (defined in 008_multi_tenant.sql)

-- chart_of_accounts
DROP POLICY IF EXISTS "chart_of_accounts_select" ON chart_of_accounts;
CREATE POLICY "chart_of_accounts_select" ON chart_of_accounts FOR SELECT
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "chart_of_accounts_insert" ON chart_of_accounts;
CREATE POLICY "chart_of_accounts_insert" ON chart_of_accounts FOR INSERT
  WITH CHECK (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "chart_of_accounts_update" ON chart_of_accounts;
CREATE POLICY "chart_of_accounts_update" ON chart_of_accounts FOR UPDATE
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "chart_of_accounts_delete" ON chart_of_accounts;
CREATE POLICY "chart_of_accounts_delete" ON chart_of_accounts FOR DELETE
  USING (organization_id::text = auth_org_id());

-- journals
DROP POLICY IF EXISTS "journals_select" ON journals;
CREATE POLICY "journals_select" ON journals FOR SELECT
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "journals_insert" ON journals;
CREATE POLICY "journals_insert" ON journals FOR INSERT
  WITH CHECK (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "journals_update" ON journals;
CREATE POLICY "journals_update" ON journals FOR UPDATE
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "journals_delete" ON journals;
CREATE POLICY "journals_delete" ON journals FOR DELETE
  USING (organization_id::text = auth_org_id());

-- journal_entries
DROP POLICY IF EXISTS "journal_entries_select" ON journal_entries;
CREATE POLICY "journal_entries_select" ON journal_entries FOR SELECT
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "journal_entries_insert" ON journal_entries;
CREATE POLICY "journal_entries_insert" ON journal_entries FOR INSERT
  WITH CHECK (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "journal_entries_update" ON journal_entries;
CREATE POLICY "journal_entries_update" ON journal_entries FOR UPDATE
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "journal_entries_delete" ON journal_entries;
CREATE POLICY "journal_entries_delete" ON journal_entries FOR DELETE
  USING (organization_id::text = auth_org_id());

-- journal_lines (uses entry_id -> join to journal_entries for org filtering)
DROP POLICY IF EXISTS "journal_lines_select" ON journal_lines;
CREATE POLICY "journal_lines_select" ON journal_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = journal_lines.entry_id
      AND je.organization_id::text = auth_org_id()
  ));

DROP POLICY IF EXISTS "journal_lines_insert" ON journal_lines;
CREATE POLICY "journal_lines_insert" ON journal_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = journal_lines.entry_id
      AND je.organization_id::text = auth_org_id()
  ));

DROP POLICY IF EXISTS "journal_lines_update" ON journal_lines;
CREATE POLICY "journal_lines_update" ON journal_lines FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = journal_lines.entry_id
      AND je.organization_id::text = auth_org_id()
  ));

DROP POLICY IF EXISTS "journal_lines_delete" ON journal_lines;
CREATE POLICY "journal_lines_delete" ON journal_lines FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = journal_lines.entry_id
      AND je.organization_id::text = auth_org_id()
  ));

-- tax_rates
DROP POLICY IF EXISTS "tax_rates_select" ON tax_rates;
CREATE POLICY "tax_rates_select" ON tax_rates FOR SELECT
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "tax_rates_insert" ON tax_rates;
CREATE POLICY "tax_rates_insert" ON tax_rates FOR INSERT
  WITH CHECK (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "tax_rates_update" ON tax_rates;
CREATE POLICY "tax_rates_update" ON tax_rates FOR UPDATE
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "tax_rates_delete" ON tax_rates;
CREATE POLICY "tax_rates_delete" ON tax_rates FOR DELETE
  USING (organization_id::text = auth_org_id());

-- tax_declarations
DROP POLICY IF EXISTS "tax_declarations_select" ON tax_declarations;
CREATE POLICY "tax_declarations_select" ON tax_declarations FOR SELECT
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "tax_declarations_insert" ON tax_declarations;
CREATE POLICY "tax_declarations_insert" ON tax_declarations FOR INSERT
  WITH CHECK (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "tax_declarations_update" ON tax_declarations;
CREATE POLICY "tax_declarations_update" ON tax_declarations FOR UPDATE
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "tax_declarations_delete" ON tax_declarations;
CREATE POLICY "tax_declarations_delete" ON tax_declarations FOR DELETE
  USING (organization_id::text = auth_org_id());

-- invoices
DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices FOR INSERT
  WITH CHECK (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices FOR UPDATE
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_delete" ON invoices FOR DELETE
  USING (organization_id::text = auth_org_id());

-- invoice_items (uses invoice_id -> join to invoices for org filtering)
DROP POLICY IF EXISTS "invoice_items_select" ON invoice_items;
CREATE POLICY "invoice_items_select" ON invoice_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM invoices inv
    WHERE inv.id = invoice_items.invoice_id
      AND inv.organization_id::text = auth_org_id()
  ));

DROP POLICY IF EXISTS "invoice_items_insert" ON invoice_items;
CREATE POLICY "invoice_items_insert" ON invoice_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices inv
    WHERE inv.id = invoice_items.invoice_id
      AND inv.organization_id::text = auth_org_id()
  ));

DROP POLICY IF EXISTS "invoice_items_update" ON invoice_items;
CREATE POLICY "invoice_items_update" ON invoice_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM invoices inv
    WHERE inv.id = invoice_items.invoice_id
      AND inv.organization_id::text = auth_org_id()
  ));

DROP POLICY IF EXISTS "invoice_items_delete" ON invoice_items;
CREATE POLICY "invoice_items_delete" ON invoice_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM invoices inv
    WHERE inv.id = invoice_items.invoice_id
      AND inv.organization_id::text = auth_org_id()
  ));

-- credit_notes
DROP POLICY IF EXISTS "credit_notes_select" ON credit_notes;
CREATE POLICY "credit_notes_select" ON credit_notes FOR SELECT
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "credit_notes_insert" ON credit_notes;
CREATE POLICY "credit_notes_insert" ON credit_notes FOR INSERT
  WITH CHECK (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "credit_notes_update" ON credit_notes;
CREATE POLICY "credit_notes_update" ON credit_notes FOR UPDATE
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "credit_notes_delete" ON credit_notes;
CREATE POLICY "credit_notes_delete" ON credit_notes FOR DELETE
  USING (organization_id::text = auth_org_id());

-- fiscal_periods
DROP POLICY IF EXISTS "fiscal_periods_select" ON fiscal_periods;
CREATE POLICY "fiscal_periods_select" ON fiscal_periods FOR SELECT
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "fiscal_periods_insert" ON fiscal_periods;
CREATE POLICY "fiscal_periods_insert" ON fiscal_periods FOR INSERT
  WITH CHECK (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "fiscal_periods_update" ON fiscal_periods;
CREATE POLICY "fiscal_periods_update" ON fiscal_periods FOR UPDATE
  USING (organization_id::text = auth_org_id());

DROP POLICY IF EXISTS "fiscal_periods_delete" ON fiscal_periods;
CREATE POLICY "fiscal_periods_delete" ON fiscal_periods FOR DELETE
  USING (organization_id::text = auth_org_id());

-- ============================================================
-- SECTION 14: SEED DATA
-- ============================================================

DO $$
DECLARE
  cm_org_id UUID;
BEGIN
  -- Get Corner Mobile organization ID
  SELECT id INTO cm_org_id FROM organizations WHERE slug = 'corner-mobile';

  IF cm_org_id IS NULL THEN
    RAISE NOTICE 'Corner Mobile organization not found, skipping seed data';
    RETURN;
  END IF;

  -- -----------------------------------------------------------
  -- CGNC Chart of Accounts (Plan Comptable Marocain)
  -- -----------------------------------------------------------

  INSERT INTO chart_of_accounts (organization_id, code, label, type) VALUES
    (cm_org_id, '1111', 'Capital social', 'class1'),
    (cm_org_id, '1481', 'Emprunts auprès des établissements de crédit', 'class1'),
    (cm_org_id, '2300', 'Immobilisations corporelles', 'class2'),
    (cm_org_id, '3111', 'Marchandises', 'class3'),
    (cm_org_id, '3421', 'Clients et comptes rattachés', 'class3'),
    (cm_org_id, '3455', 'État — TVA récupérable', 'class3'),
    (cm_org_id, '4111', 'Fournisseurs et comptes rattachés', 'class4'),
    (cm_org_id, '4452', 'État — Impôts, taxes et assimilés', 'class4'),
    (cm_org_id, '4455', 'État — TVA facturée', 'class4'),
    (cm_org_id, '5141', 'Banques', 'class5'),
    (cm_org_id, '5161', 'Caisse', 'class5'),
    (cm_org_id, '6111', 'Achats de marchandises', 'class6'),
    (cm_org_id, '6121', 'Achats consommés de matières et fournitures', 'class6'),
    (cm_org_id, '6131', 'Locations et charges locatives', 'class6'),
    (cm_org_id, '6171', 'Charges de personnel', 'class6'),
    (cm_org_id, '7111', 'Ventes de marchandises', 'class7'),
    (cm_org_id, '7124', 'Variation des stocks de produits', 'class7'),
    (cm_org_id, '7127', 'Ventes de produits et services', 'class7')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- -----------------------------------------------------------
  -- Default Journals
  -- -----------------------------------------------------------

  INSERT INTO journals (organization_id, code, label, type) VALUES
    (cm_org_id, 'VT', 'Journal des ventes', 'sales'),
    (cm_org_id, 'AC', 'Journal des achats', 'purchases'),
    (cm_org_id, 'CA', 'Journal de caisse', 'cash'),
    (cm_org_id, 'BQ', 'Journal de banque', 'bank'),
    (cm_org_id, 'OD', 'Opérations diverses', 'od')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- -----------------------------------------------------------
  -- Default Tax Rates (Morocco TVA)
  -- -----------------------------------------------------------

  INSERT INTO tax_rates (organization_id, code, label, rate, type, account_code) VALUES
    (cm_org_id, 'TVA20',        'TVA 20%',                    20.00, 'vat_collected',   '4455'),
    (cm_org_id, 'TVA14',        'TVA 14%',                    14.00, 'vat_collected',   '4455'),
    (cm_org_id, 'TVA10',        'TVA 10%',                    10.00, 'vat_collected',   '4455'),
    (cm_org_id, 'TVA7',         'TVA 7%',                      7.00, 'vat_collected',   '4455'),
    (cm_org_id, 'TVA0_EXPORT',  'TVA 0% — Export',             0.00, 'vat_collected',   '4455'),
    (cm_org_id, 'TVA0_EXEMPT',  'TVA 0% — Exonéré',            0.00, 'vat_collected',   '4455'),
    (cm_org_id, 'TVA20_DED',    'TVA 20% — Déductible',       20.00, 'vat_deductible',  '3455'),
    (cm_org_id, 'TVA14_DED',    'TVA 14% — Déductible',       14.00, 'vat_deductible',  '3455')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- -----------------------------------------------------------
  -- Default Fiscal Periods (2025 + 2026)
  -- -----------------------------------------------------------

  -- 2025: months 1-12
  INSERT INTO fiscal_periods (organization_id, year, month, status) VALUES
    (cm_org_id, 2025,  1, 'open'),
    (cm_org_id, 2025,  2, 'open'),
    (cm_org_id, 2025,  3, 'open'),
    (cm_org_id, 2025,  4, 'open'),
    (cm_org_id, 2025,  5, 'open'),
    (cm_org_id, 2025,  6, 'open'),
    (cm_org_id, 2025,  7, 'open'),
    (cm_org_id, 2025,  8, 'open'),
    (cm_org_id, 2025,  9, 'open'),
    (cm_org_id, 2025, 10, 'open'),
    (cm_org_id, 2025, 11, 'open'),
    (cm_org_id, 2025, 12, 'open')
  ON CONFLICT (organization_id, year, month) DO NOTHING;

  -- 2026: months 1-12
  INSERT INTO fiscal_periods (organization_id, year, month, status) VALUES
    (cm_org_id, 2026,  1, 'open'),
    (cm_org_id, 2026,  2, 'open'),
    (cm_org_id, 2026,  3, 'open'),
    (cm_org_id, 2026,  4, 'open'),
    (cm_org_id, 2026,  5, 'open'),
    (cm_org_id, 2026,  6, 'open'),
    (cm_org_id, 2026,  7, 'open'),
    (cm_org_id, 2026,  8, 'open'),
    (cm_org_id, 2026,  9, 'open'),
    (cm_org_id, 2026, 10, 'open'),
    (cm_org_id, 2026, 11, 'open'),
    (cm_org_id, 2026, 12, 'open')
  ON CONFLICT (organization_id, year, month) DO NOTHING;

END $$;

COMMIT;
