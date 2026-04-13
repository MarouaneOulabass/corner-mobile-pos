-- Corner Mobile — Migration 008: Multi-Tenant (Organization-Level Isolation)
--
-- This migration transforms the single-tenant Corner Mobile app into a
-- multi-tenant SaaS platform. Every business table gets an organization_id
-- column, all RLS policies are rewritten to enforce org-level isolation,
-- and existing data is backfilled to the "Corner Mobile" organization.
--
-- The migration is fully idempotent: safe to re-run.

BEGIN;

-- ============================================================
-- SECTION 1: ORGANIZATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  country TEXT NOT NULL DEFAULT 'MA',
  plan TEXT NOT NULL DEFAULT 'starter',
  billing_status TEXT DEFAULT 'active',
  ice TEXT,             -- Moroccan tax ID (Identifiant Commun de l'Entreprise)
  if_number TEXT,       -- Identifiant Fiscal
  rc TEXT,              -- Registre du Commerce
  cnss TEXT,            -- Social security number
  patente TEXT,         -- Business tax number
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2AA8DC',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- SECTION 2: SEED ORGANIZATIONS
-- ============================================================

INSERT INTO organizations (name, slug, country, plan, billing_status)
VALUES ('Corner Mobile', 'corner-mobile', 'MA', 'enterprise', 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO organizations (name, slug, country, plan)
VALUES ('Acme Mobile (Test)', 'acme-mobile', 'MA', 'starter')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SECTION 3: ADD organization_id TO ALL BUSINESS TABLES
-- ============================================================
-- Strategy per table:
--   1. ADD COLUMN IF NOT EXISTS (nullable)
--   2. Backfill with Corner Mobile org id
--   3. SET NOT NULL
--   4. ADD FK constraint

DO $$
DECLARE
  cm_org_id UUID;
  tbl TEXT;
  -- All tables that need organization_id
  all_tables TEXT[] := ARRAY[
    'stores',
    'users',
    'products',
    'customers',
    'sales',
    'sale_items',
    'repairs',
    'repair_status_log',
    'transfers',
    'notifications',
    'ai_logs',
    'labels_log',
    'product_audit_log',
    'data_journal',
    'suppliers',
    'returns',
    'return_items',
    'trade_ins',
    'parts_inventory',
    'repair_parts_used',
    'cash_sessions',
    'cash_movements',
    'installment_plans',
    'installment_payments',
    'gift_cards',
    'gift_card_transactions',
    'loyalty_settings',
    'loyalty_transactions',
    'commission_rules',
    'commissions',
    'clock_records',
    'stock_alert_rules',
    'checklist_templates',
    'receipt_templates',
    'purchase_orders',
    'po_items',
    'signatures',
    'sessions',
    'user_2fa',
    'audit_log'
  ];
BEGIN
  -- Get Corner Mobile org ID
  SELECT id INTO cm_org_id FROM organizations WHERE slug = 'corner-mobile';

  FOREACH tbl IN ARRAY all_tables LOOP
    BEGIN
      -- Step 1: Add column (nullable) if not exists
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id UUID',
        tbl
      );

      -- Step 2: Backfill existing rows with Corner Mobile org
      EXECUTE format(
        'UPDATE %I SET organization_id = %L WHERE organization_id IS NULL',
        tbl, cm_org_id
      );

      -- Step 3: Set NOT NULL
      -- Check if column is already NOT NULL to avoid error
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = tbl
          AND column_name = 'organization_id'
          AND is_nullable = 'YES'
      ) THEN
        EXECUTE format(
          'ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL',
          tbl
        );
      END IF;

      -- Step 4: Add FK constraint if not exists
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = tbl || '_organization_id_fkey'
      ) THEN
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES organizations(id)',
          tbl, tbl || '_organization_id_fkey'
        );
      END IF;

    EXCEPTION WHEN undefined_table THEN
      -- Table doesn't exist yet, skip
      RAISE NOTICE 'Table % does not exist, skipping', tbl;
    END;
  END LOOP;
END $$;

-- ============================================================
-- SECTION 4: COMPOSITE INDEXES (organization_id, store_id)
-- ============================================================
-- For tables that have both columns, create a composite index
-- for efficient org+store filtering.

DO $$
DECLARE
  tbl TEXT;
  idx_name TEXT;
  -- Tables that have both organization_id AND store_id
  store_tables TEXT[] := ARRAY[
    'stores',
    'users',
    'products',
    'sales',
    'repairs',
    'data_journal',
    'suppliers',
    'returns',
    'trade_ins',
    'parts_inventory',
    'cash_sessions',
    'cash_movements',
    'installment_plans',
    'loyalty_settings',
    'loyalty_transactions',
    'commission_rules',
    'commissions',
    'clock_records',
    'stock_alert_rules',
    'checklist_templates',
    'receipt_templates',
    'purchase_orders'
  ];
BEGIN
  FOREACH tbl IN ARRAY store_tables LOOP
    idx_name := 'idx_' || tbl || '_org_store';
    BEGIN
      -- Check if index already exists
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = idx_name
      ) THEN
        EXECUTE format(
          'CREATE INDEX %I ON %I (organization_id, store_id)',
          idx_name, tbl
        );
      END IF;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    WHEN undefined_column THEN
      -- store_id column might not exist on this table variant
      NULL;
    END;
  END LOOP;
END $$;

-- Also create org-only indexes on tables without store_id
DO $$
DECLARE
  tbl TEXT;
  idx_name TEXT;
  no_store_tables TEXT[] := ARRAY[
    'customers',
    'sale_items',
    'repair_status_log',
    'return_items',
    'repair_parts_used',
    'installment_payments',
    'gift_cards',
    'gift_card_transactions',
    'notifications',
    'ai_logs',
    'labels_log',
    'product_audit_log',
    'po_items',
    'signatures',
    'sessions',
    'user_2fa',
    'audit_log',
    'transfers'
  ];
BEGIN
  FOREACH tbl IN ARRAY no_store_tables LOOP
    idx_name := 'idx_' || tbl || '_org';
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = idx_name
      ) THEN
        EXECUTE format(
          'CREATE INDEX %I ON %I (organization_id)',
          idx_name, tbl
        );
      END IF;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- SECTION 5: JWT HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION auth_org_id() RETURNS TEXT AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'org_id',
    ''
  );
$$ LANGUAGE sql STABLE;

-- ============================================================
-- SECTION 6: DROP ALL EXISTING RLS POLICIES
-- ============================================================
-- We must drop all policies from migrations 006 and 007 before
-- recreating them with organization_id filtering.

-- 006 policies: core tables
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;

DROP POLICY IF EXISTS "sales_select" ON sales;
DROP POLICY IF EXISTS "sales_insert" ON sales;

DROP POLICY IF EXISTS "sale_items_select" ON sale_items;
DROP POLICY IF EXISTS "sale_items_insert" ON sale_items;

DROP POLICY IF EXISTS "customers_all" ON customers;

DROP POLICY IF EXISTS "repairs_select" ON repairs;
DROP POLICY IF EXISTS "repairs_insert" ON repairs;
DROP POLICY IF EXISTS "repairs_update" ON repairs;

DROP POLICY IF EXISTS "repair_status_log_select" ON repair_status_log;
DROP POLICY IF EXISTS "repair_status_log_insert" ON repair_status_log;

DROP POLICY IF EXISTS "transfers_select" ON transfers;
DROP POLICY IF EXISTS "transfers_insert" ON transfers;

DROP POLICY IF EXISTS "stores_select" ON stores;
DROP POLICY IF EXISTS "stores_write" ON stores;

DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_write" ON users;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;

DROP POLICY IF EXISTS "ai_logs_select" ON ai_logs;
DROP POLICY IF EXISTS "ai_logs_insert" ON ai_logs;

DROP POLICY IF EXISTS "labels_log_select" ON labels_log;
DROP POLICY IF EXISTS "labels_log_insert" ON labels_log;

DROP POLICY IF EXISTS "product_audit_log_select" ON product_audit_log;
DROP POLICY IF EXISTS "product_audit_log_insert" ON product_audit_log;

DROP POLICY IF EXISTS "data_journal_select" ON data_journal;
DROP POLICY IF EXISTS "data_journal_insert" ON data_journal;

-- 007 policies: feature tables
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;

DROP POLICY IF EXISTS "returns_select" ON returns;
DROP POLICY IF EXISTS "returns_insert" ON returns;
DROP POLICY IF EXISTS "returns_update" ON returns;
DROP POLICY IF EXISTS "returns_delete" ON returns;

DROP POLICY IF EXISTS "return_items_select" ON return_items;
DROP POLICY IF EXISTS "return_items_insert" ON return_items;
DROP POLICY IF EXISTS "return_items_delete" ON return_items;

DROP POLICY IF EXISTS "trade_ins_select" ON trade_ins;
DROP POLICY IF EXISTS "trade_ins_insert" ON trade_ins;
DROP POLICY IF EXISTS "trade_ins_update" ON trade_ins;
DROP POLICY IF EXISTS "trade_ins_delete" ON trade_ins;

DROP POLICY IF EXISTS "parts_inventory_select" ON parts_inventory;
DROP POLICY IF EXISTS "parts_inventory_insert" ON parts_inventory;
DROP POLICY IF EXISTS "parts_inventory_update" ON parts_inventory;
DROP POLICY IF EXISTS "parts_inventory_delete" ON parts_inventory;

DROP POLICY IF EXISTS "repair_parts_used_select" ON repair_parts_used;
DROP POLICY IF EXISTS "repair_parts_used_insert" ON repair_parts_used;
DROP POLICY IF EXISTS "repair_parts_used_delete" ON repair_parts_used;

DROP POLICY IF EXISTS "cash_sessions_select" ON cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_insert" ON cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_update" ON cash_sessions;

DROP POLICY IF EXISTS "cash_movements_select" ON cash_movements;
DROP POLICY IF EXISTS "cash_movements_insert" ON cash_movements;

DROP POLICY IF EXISTS "installment_plans_select" ON installment_plans;
DROP POLICY IF EXISTS "installment_plans_insert" ON installment_plans;
DROP POLICY IF EXISTS "installment_plans_update" ON installment_plans;

DROP POLICY IF EXISTS "installment_payments_select" ON installment_payments;
DROP POLICY IF EXISTS "installment_payments_insert" ON installment_payments;

DROP POLICY IF EXISTS "gift_cards_select" ON gift_cards;
DROP POLICY IF EXISTS "gift_cards_insert" ON gift_cards;
DROP POLICY IF EXISTS "gift_cards_update" ON gift_cards;
DROP POLICY IF EXISTS "gift_cards_delete" ON gift_cards;

DROP POLICY IF EXISTS "gift_card_transactions_select" ON gift_card_transactions;
DROP POLICY IF EXISTS "gift_card_transactions_insert" ON gift_card_transactions;

DROP POLICY IF EXISTS "loyalty_settings_select" ON loyalty_settings;
DROP POLICY IF EXISTS "loyalty_settings_insert" ON loyalty_settings;
DROP POLICY IF EXISTS "loyalty_settings_update" ON loyalty_settings;

DROP POLICY IF EXISTS "loyalty_transactions_select" ON loyalty_transactions;
DROP POLICY IF EXISTS "loyalty_transactions_insert" ON loyalty_transactions;

DROP POLICY IF EXISTS "commission_rules_select" ON commission_rules;
DROP POLICY IF EXISTS "commission_rules_insert" ON commission_rules;
DROP POLICY IF EXISTS "commission_rules_update" ON commission_rules;
DROP POLICY IF EXISTS "commission_rules_delete" ON commission_rules;

DROP POLICY IF EXISTS "commissions_select" ON commissions;
DROP POLICY IF EXISTS "commissions_insert" ON commissions;
DROP POLICY IF EXISTS "commissions_update" ON commissions;

DROP POLICY IF EXISTS "clock_records_select" ON clock_records;
DROP POLICY IF EXISTS "clock_records_insert" ON clock_records;
DROP POLICY IF EXISTS "clock_records_update" ON clock_records;

DROP POLICY IF EXISTS "stock_alert_rules_select" ON stock_alert_rules;
DROP POLICY IF EXISTS "stock_alert_rules_insert" ON stock_alert_rules;
DROP POLICY IF EXISTS "stock_alert_rules_update" ON stock_alert_rules;
DROP POLICY IF EXISTS "stock_alert_rules_delete" ON stock_alert_rules;

DROP POLICY IF EXISTS "checklist_templates_select" ON checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_insert" ON checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_update" ON checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_delete" ON checklist_templates;

DROP POLICY IF EXISTS "receipt_templates_select" ON receipt_templates;
DROP POLICY IF EXISTS "receipt_templates_insert" ON receipt_templates;
DROP POLICY IF EXISTS "receipt_templates_update" ON receipt_templates;

DROP POLICY IF EXISTS "purchase_orders_select" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_insert" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_update" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_delete" ON purchase_orders;

DROP POLICY IF EXISTS "po_items_select" ON po_items;
DROP POLICY IF EXISTS "po_items_insert" ON po_items;
DROP POLICY IF EXISTS "po_items_update" ON po_items;
DROP POLICY IF EXISTS "po_items_delete" ON po_items;

DROP POLICY IF EXISTS "signatures_select" ON signatures;
DROP POLICY IF EXISTS "signatures_insert" ON signatures;

DROP POLICY IF EXISTS "sessions_select" ON sessions;
DROP POLICY IF EXISTS "sessions_insert" ON sessions;
DROP POLICY IF EXISTS "sessions_update" ON sessions;
DROP POLICY IF EXISTS "sessions_delete" ON sessions;

DROP POLICY IF EXISTS "user_2fa_select" ON user_2fa;
DROP POLICY IF EXISTS "user_2fa_insert" ON user_2fa;
DROP POLICY IF EXISTS "user_2fa_update" ON user_2fa;
DROP POLICY IF EXISTS "user_2fa_delete" ON user_2fa;

DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;


-- ============================================================
-- SECTION 7: RECREATE ALL RLS POLICIES WITH org_id FILTERING
-- ============================================================
-- Pattern for tables with store_id:
--   organization_id::text = auth_org_id()
--   AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
--
-- Pattern for tables with parent join:
--   organization_id::text = auth_org_id() AND <parent subquery>
--
-- Pattern for org-only tables (no store_id):
--   organization_id::text = auth_org_id()

-- ----------------------------------------------------------
-- STORES
-- ----------------------------------------------------------
CREATE POLICY "stores_select" ON stores FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR id::text = auth_store_id())
  );

CREATE POLICY "stores_write" ON stores FOR ALL TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() = 'superadmin'
  )
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND auth_role_claim() = 'superadmin'
  );

-- ----------------------------------------------------------
-- USERS
-- ----------------------------------------------------------
CREATE POLICY "users_select" ON users FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (
      auth_role_claim() = 'superadmin'
      OR store_id::text = auth_store_id()
      OR id::text = auth_user_id()
    )
  );

CREATE POLICY "users_write" ON users FOR ALL TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() = 'superadmin'
  )
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND auth_role_claim() = 'superadmin'
  );

-- ----------------------------------------------------------
-- PRODUCTS
-- ----------------------------------------------------------
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "products_insert" ON products FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "products_update" ON products FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "products_delete" ON products FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- CUSTOMERS (org-scoped, not store-scoped — shared across stores in same org)
-- ----------------------------------------------------------
CREATE POLICY "customers_select" ON customers FOR SELECT TO authenticated
  USING (organization_id::text = auth_org_id());

CREATE POLICY "customers_insert" ON customers FOR INSERT TO authenticated
  WITH CHECK (organization_id::text = auth_org_id());

CREATE POLICY "customers_update" ON customers FOR UPDATE TO authenticated
  USING (organization_id::text = auth_org_id());

CREATE POLICY "customers_delete" ON customers FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
  );

-- ----------------------------------------------------------
-- SALES
-- ----------------------------------------------------------
CREATE POLICY "sales_select" ON sales FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "sales_insert" ON sales FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- SALE_ITEMS (join to sales for org check)
-- ----------------------------------------------------------
CREATE POLICY "sale_items_select" ON sale_items FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
      AND s.organization_id::text = auth_org_id()
      AND (auth_role_claim() = 'superadmin' OR s.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "sale_items_insert" ON sale_items FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
  );

-- ----------------------------------------------------------
-- REPAIRS
-- ----------------------------------------------------------
CREATE POLICY "repairs_select" ON repairs FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "repairs_insert" ON repairs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "repairs_update" ON repairs FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- REPAIR_STATUS_LOG (join to repairs)
-- ----------------------------------------------------------
CREATE POLICY "repair_status_log_select" ON repair_status_log FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM repairs r
      WHERE r.id = repair_status_log.repair_id
      AND r.organization_id::text = auth_org_id()
      AND (auth_role_claim() = 'superadmin' OR r.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "repair_status_log_insert" ON repair_status_log FOR INSERT TO authenticated
  WITH CHECK (organization_id::text = auth_org_id());

-- ----------------------------------------------------------
-- TRANSFERS (has from_store_id and to_store_id, not store_id)
-- ----------------------------------------------------------
CREATE POLICY "transfers_select" ON transfers FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (
      auth_role_claim() = 'superadmin'
      OR from_store_id::text = auth_store_id()
      OR to_store_id::text = auth_store_id()
    )
  );

CREATE POLICY "transfers_insert" ON transfers FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
  );

-- ----------------------------------------------------------
-- NOTIFICATIONS (per user, org-scoped)
-- ----------------------------------------------------------
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR user_id::text = auth_user_id())
  );

CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR user_id::text = auth_user_id())
  );

-- ----------------------------------------------------------
-- AI_LOGS (manager+ read, any authenticated write)
-- ----------------------------------------------------------
CREATE POLICY "ai_logs_select" ON ai_logs FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
  );

CREATE POLICY "ai_logs_insert" ON ai_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id::text = auth_org_id());

-- ----------------------------------------------------------
-- LABELS_LOG
-- ----------------------------------------------------------
CREATE POLICY "labels_log_select" ON labels_log FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
  );

CREATE POLICY "labels_log_insert" ON labels_log FOR INSERT TO authenticated
  WITH CHECK (organization_id::text = auth_org_id());

-- ----------------------------------------------------------
-- PRODUCT_AUDIT_LOG
-- ----------------------------------------------------------
CREATE POLICY "product_audit_log_select" ON product_audit_log FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
  );

CREATE POLICY "product_audit_log_insert" ON product_audit_log FOR INSERT TO authenticated
  WITH CHECK (organization_id::text = auth_org_id());

-- ----------------------------------------------------------
-- DATA_JOURNAL (append-only, superadmin reads)
-- ----------------------------------------------------------
CREATE POLICY "data_journal_select" ON data_journal FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() = 'superadmin'
  );

CREATE POLICY "data_journal_insert" ON data_journal FOR INSERT TO authenticated
  WITH CHECK (organization_id::text = auth_org_id());

-- ----------------------------------------------------------
-- SUPPLIERS (store_id nullable = global supplier within org)
-- ----------------------------------------------------------
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (
      auth_role_claim() = 'superadmin'
      OR store_id IS NULL
      OR store_id::text = auth_store_id()
    )
  );

CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id IS NULL OR store_id::text = auth_store_id())
  );

CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id IS NULL OR store_id::text = auth_store_id())
  );

CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- RETURNS
-- ----------------------------------------------------------
CREATE POLICY "returns_select" ON returns FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "returns_insert" ON returns FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "returns_update" ON returns FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "returns_delete" ON returns FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- RETURN_ITEMS (join to returns)
-- ----------------------------------------------------------
CREATE POLICY "return_items_select" ON return_items FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM returns r
      WHERE r.id = return_items.return_id
      AND r.organization_id::text = auth_org_id()
      AND (auth_role_claim() = 'superadmin' OR r.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "return_items_insert" ON return_items FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM returns r
      WHERE r.id = return_items.return_id
      AND r.organization_id::text = auth_org_id()
      AND (auth_role_claim() = 'superadmin' OR r.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "return_items_delete" ON return_items FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND EXISTS (
      SELECT 1 FROM returns r
      WHERE r.id = return_items.return_id
      AND r.organization_id::text = auth_org_id()
      AND (auth_role_claim() = 'superadmin' OR r.store_id::text = auth_store_id())
    )
  );

-- ----------------------------------------------------------
-- TRADE_INS
-- ----------------------------------------------------------
CREATE POLICY "trade_ins_select" ON trade_ins FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "trade_ins_insert" ON trade_ins FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "trade_ins_update" ON trade_ins FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "trade_ins_delete" ON trade_ins FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- PARTS_INVENTORY
-- ----------------------------------------------------------
CREATE POLICY "parts_inventory_select" ON parts_inventory FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "parts_inventory_insert" ON parts_inventory FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "parts_inventory_update" ON parts_inventory FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "parts_inventory_delete" ON parts_inventory FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- REPAIR_PARTS_USED (join to repairs)
-- ----------------------------------------------------------
CREATE POLICY "repair_parts_used_select" ON repair_parts_used FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM repairs r
      WHERE r.id = repair_parts_used.repair_id
      AND r.organization_id::text = auth_org_id()
      AND (auth_role_claim() = 'superadmin' OR r.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "repair_parts_used_insert" ON repair_parts_used FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM repairs r
      WHERE r.id = repair_parts_used.repair_id
      AND r.organization_id::text = auth_org_id()
      AND (auth_role_claim() = 'superadmin' OR r.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "repair_parts_used_delete" ON repair_parts_used FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND EXISTS (
      SELECT 1 FROM repairs r
      WHERE r.id = repair_parts_used.repair_id
      AND r.organization_id::text = auth_org_id()
      AND (auth_role_claim() = 'superadmin' OR r.store_id::text = auth_store_id())
    )
  );

-- ----------------------------------------------------------
-- CASH_SESSIONS
-- ----------------------------------------------------------
CREATE POLICY "cash_sessions_select" ON cash_sessions FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "cash_sessions_insert" ON cash_sessions FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "cash_sessions_update" ON cash_sessions FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- CASH_MOVEMENTS
-- ----------------------------------------------------------
CREATE POLICY "cash_movements_select" ON cash_movements FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "cash_movements_insert" ON cash_movements FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- INSTALLMENT_PLANS
-- ----------------------------------------------------------
CREATE POLICY "installment_plans_select" ON installment_plans FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "installment_plans_insert" ON installment_plans FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "installment_plans_update" ON installment_plans FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- INSTALLMENT_PAYMENTS (join to installment_plans)
-- ----------------------------------------------------------
CREATE POLICY "installment_payments_select" ON installment_payments FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM installment_plans ip
      WHERE ip.id = installment_payments.plan_id
      AND ip.organization_id::text = auth_org_id()
      AND (auth_role_claim() = 'superadmin' OR ip.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "installment_payments_insert" ON installment_payments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM installment_plans ip
      WHERE ip.id = installment_payments.plan_id
      AND ip.organization_id::text = auth_org_id()
      AND (auth_role_claim() = 'superadmin' OR ip.store_id::text = auth_store_id())
    )
  );

-- ----------------------------------------------------------
-- GIFT_CARDS (SELECT visible within org for cross-store redemption)
-- ----------------------------------------------------------
CREATE POLICY "gift_cards_select" ON gift_cards FOR SELECT TO authenticated
  USING (organization_id::text = auth_org_id());

CREATE POLICY "gift_cards_insert" ON gift_cards FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "gift_cards_update" ON gift_cards FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (
      auth_role_claim() = 'superadmin'
      OR store_id::text = auth_store_id()
      OR auth_role_claim() IN ('manager', 'seller')  -- cross-store redemption
    )
  );

CREATE POLICY "gift_cards_delete" ON gift_cards FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- GIFT_CARD_TRANSACTIONS (org-scoped, globally visible within org)
-- ----------------------------------------------------------
CREATE POLICY "gift_card_transactions_select" ON gift_card_transactions FOR SELECT TO authenticated
  USING (organization_id::text = auth_org_id());

CREATE POLICY "gift_card_transactions_insert" ON gift_card_transactions FOR INSERT TO authenticated
  WITH CHECK (organization_id::text = auth_org_id());

-- ----------------------------------------------------------
-- LOYALTY_SETTINGS
-- ----------------------------------------------------------
CREATE POLICY "loyalty_settings_select" ON loyalty_settings FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "loyalty_settings_insert" ON loyalty_settings FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "loyalty_settings_update" ON loyalty_settings FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- LOYALTY_TRANSACTIONS
-- ----------------------------------------------------------
CREATE POLICY "loyalty_transactions_select" ON loyalty_transactions FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "loyalty_transactions_insert" ON loyalty_transactions FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- COMMISSION_RULES
-- ----------------------------------------------------------
CREATE POLICY "commission_rules_select" ON commission_rules FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "commission_rules_insert" ON commission_rules FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "commission_rules_update" ON commission_rules FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "commission_rules_delete" ON commission_rules FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- COMMISSIONS
-- ----------------------------------------------------------
CREATE POLICY "commissions_select" ON commissions FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "commissions_insert" ON commissions FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "commissions_update" ON commissions FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- CLOCK_RECORDS
-- ----------------------------------------------------------
CREATE POLICY "clock_records_select" ON clock_records FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "clock_records_insert" ON clock_records FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "clock_records_update" ON clock_records FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- STOCK_ALERT_RULES
-- ----------------------------------------------------------
CREATE POLICY "stock_alert_rules_select" ON stock_alert_rules FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "stock_alert_rules_insert" ON stock_alert_rules FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "stock_alert_rules_update" ON stock_alert_rules FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "stock_alert_rules_delete" ON stock_alert_rules FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- CHECKLIST_TEMPLATES (store_id nullable = org-wide template)
-- ----------------------------------------------------------
CREATE POLICY "checklist_templates_select" ON checklist_templates FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (
      auth_role_claim() = 'superadmin'
      OR store_id IS NULL
      OR store_id::text = auth_store_id()
    )
  );

CREATE POLICY "checklist_templates_insert" ON checklist_templates FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id IS NULL OR store_id::text = auth_store_id())
  );

CREATE POLICY "checklist_templates_update" ON checklist_templates FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id IS NULL OR store_id::text = auth_store_id())
  );

CREATE POLICY "checklist_templates_delete" ON checklist_templates FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- RECEIPT_TEMPLATES
-- ----------------------------------------------------------
CREATE POLICY "receipt_templates_select" ON receipt_templates FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "receipt_templates_insert" ON receipt_templates FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "receipt_templates_update" ON receipt_templates FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- PURCHASE_ORDERS
-- ----------------------------------------------------------
CREATE POLICY "purchase_orders_select" ON purchase_orders FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "purchase_orders_insert" ON purchase_orders FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "purchase_orders_update" ON purchase_orders FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "purchase_orders_delete" ON purchase_orders FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- PO_ITEMS (join to purchase_orders)
-- ----------------------------------------------------------
CREATE POLICY "po_items_select" ON po_items FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_items.po_id
      AND po.organization_id::text = auth_org_id()
      AND (auth_role_claim() = 'superadmin' OR po.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "po_items_insert" ON po_items FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_items.po_id
      AND po.organization_id::text = auth_org_id()
      AND (auth_role_claim() = 'superadmin' OR po.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "po_items_update" ON po_items FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_items.po_id
      AND po.organization_id::text = auth_org_id()
      AND (auth_role_claim() = 'superadmin' OR po.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "po_items_delete" ON po_items FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
    AND EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_items.po_id
      AND po.organization_id::text = auth_org_id()
      AND (auth_role_claim() = 'superadmin' OR po.store_id::text = auth_store_id())
    )
  );

-- ----------------------------------------------------------
-- SIGNATURES (org-scoped, visible to all authenticated within org)
-- ----------------------------------------------------------
CREATE POLICY "signatures_select" ON signatures FOR SELECT TO authenticated
  USING (organization_id::text = auth_org_id());

CREATE POLICY "signatures_insert" ON signatures FOR INSERT TO authenticated
  WITH CHECK (organization_id::text = auth_org_id());

-- ----------------------------------------------------------
-- SESSIONS (per user, org-scoped)
-- ----------------------------------------------------------
CREATE POLICY "sessions_select" ON sessions FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR user_id::text = auth_user_id())
  );

CREATE POLICY "sessions_insert" ON sessions FOR INSERT TO authenticated
  WITH CHECK (organization_id::text = auth_org_id());

CREATE POLICY "sessions_update" ON sessions FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR user_id::text = auth_user_id())
  );

CREATE POLICY "sessions_delete" ON sessions FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() = 'superadmin'
  );

-- ----------------------------------------------------------
-- USER_2FA (per user, org-scoped)
-- ----------------------------------------------------------
CREATE POLICY "user_2fa_select" ON user_2fa FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR user_id::text = auth_user_id())
  );

CREATE POLICY "user_2fa_insert" ON user_2fa FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text = auth_org_id()
    AND user_id::text = auth_user_id()
  );

CREATE POLICY "user_2fa_update" ON user_2fa FOR UPDATE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND user_id::text = auth_user_id()
  );

CREATE POLICY "user_2fa_delete" ON user_2fa FOR DELETE TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND (auth_role_claim() = 'superadmin' OR user_id::text = auth_user_id())
  );

-- ----------------------------------------------------------
-- AUDIT_LOG
-- ----------------------------------------------------------
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT TO authenticated
  USING (
    organization_id::text = auth_org_id()
    AND auth_role_claim() IN ('superadmin', 'manager')
  );

CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT TO authenticated
  WITH CHECK (organization_id::text = auth_org_id());


-- ============================================================
-- SECTION 8: RLS ON ORGANIZATIONS TABLE
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users can see their own organization
DROP POLICY IF EXISTS "organizations_select" ON organizations;
CREATE POLICY "organizations_select" ON organizations FOR SELECT TO authenticated
  USING (id::text = auth_org_id());

-- Only superadmin can modify organizations
DROP POLICY IF EXISTS "organizations_insert" ON organizations;
CREATE POLICY "organizations_insert" ON organizations FOR INSERT TO authenticated
  WITH CHECK (auth_role_claim() = 'superadmin');

DROP POLICY IF EXISTS "organizations_update" ON organizations;
CREATE POLICY "organizations_update" ON organizations FOR UPDATE TO authenticated
  USING (
    id::text = auth_org_id()
    AND auth_role_claim() = 'superadmin'
  );

DROP POLICY IF EXISTS "organizations_delete" ON organizations;
CREATE POLICY "organizations_delete" ON organizations FOR DELETE TO authenticated
  USING (auth_role_claim() = 'superadmin');


COMMIT;
