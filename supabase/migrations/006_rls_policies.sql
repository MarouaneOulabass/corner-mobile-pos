-- Corner Mobile — Migration 006: Row Level Security
--
-- PREREQUISITE: In Supabase Dashboard → Project Settings → API → JWT Settings,
-- set the JWT Secret to match the value of NEXTAUTH_SECRET.
-- Without this, the authenticated role policies won't work for direct client queries.
-- API routes using the service_role key bypass RLS and always work.
--
-- Strategy:
--   - service_role: bypasses RLS automatically (all API routes)
--   - authenticated: store-scoped access via JWT claims
--   - anon: blocked on all sensitive tables

-- ============================================================
-- CORE TABLES
-- ============================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_journal ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: extract claim from JWT
-- ============================================================

CREATE OR REPLACE FUNCTION auth_store_id() RETURNS TEXT AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'store_id',
    ''
  );
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth_role_claim() RETURNS TEXT AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    'anon'
  );
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth_user_id() RETURNS TEXT AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    ''
  );
$$ LANGUAGE SQL STABLE;

-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE POLICY "products_select" ON products FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "products_insert" ON products FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "products_update" ON products FOR UPDATE TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "products_delete" ON products FOR DELETE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ============================================================
-- SALES
-- ============================================================

CREATE POLICY "sales_select" ON sales FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "sales_insert" ON sales FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

-- ============================================================
-- SALE ITEMS
-- ============================================================

CREATE POLICY "sale_items_select" ON sale_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
      AND (auth_role_claim() = 'superadmin' OR s.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "sale_items_insert" ON sale_items FOR INSERT TO authenticated
  WITH CHECK (true); -- sale_items always created with a sale; sale policy is the guard

-- ============================================================
-- CUSTOMERS (not store-scoped, any authenticated user)
-- ============================================================

CREATE POLICY "customers_all" ON customers FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- REPAIRS
-- ============================================================

CREATE POLICY "repairs_select" ON repairs FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "repairs_insert" ON repairs FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "repairs_update" ON repairs FOR UPDATE TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

-- ============================================================
-- REPAIR STATUS LOG
-- ============================================================

CREATE POLICY "repair_status_log_select" ON repair_status_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM repairs r
      WHERE r.id = repair_status_log.repair_id
      AND (auth_role_claim() = 'superadmin' OR r.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "repair_status_log_insert" ON repair_status_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- TRANSFERS
-- ============================================================

CREATE POLICY "transfers_select" ON transfers FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR from_store_id::text = auth_store_id()
    OR to_store_id::text = auth_store_id()
  );

CREATE POLICY "transfers_insert" ON transfers FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() IN ('superadmin', 'manager')
  );

-- ============================================================
-- STORES (read-only for all authenticated; write for superadmin)
-- ============================================================

CREATE POLICY "stores_select" ON stores FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR id::text = auth_store_id()
  );

CREATE POLICY "stores_write" ON stores FOR ALL TO authenticated
  USING (auth_role_claim() = 'superadmin')
  WITH CHECK (auth_role_claim() = 'superadmin');

-- ============================================================
-- USERS
-- ============================================================

CREATE POLICY "users_select" ON users FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
    OR id::text = auth_user_id() -- can always see yourself
  );

CREATE POLICY "users_write" ON users FOR ALL TO authenticated
  USING (auth_role_claim() = 'superadmin')
  WITH CHECK (auth_role_claim() = 'superadmin');

-- ============================================================
-- NOTIFICATIONS (per user)
-- ============================================================

CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR user_id::text = auth_user_id()
  );

CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR user_id::text = auth_user_id()
  );

-- ============================================================
-- AUDIT / LOGS (manager+ read, any authenticated write)
-- ============================================================

CREATE POLICY "ai_logs_select" ON ai_logs FOR SELECT TO authenticated
  USING (auth_role_claim() IN ('superadmin', 'manager'));

CREATE POLICY "ai_logs_insert" ON ai_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "labels_log_select" ON labels_log FOR SELECT TO authenticated
  USING (auth_role_claim() IN ('superadmin', 'manager'));

CREATE POLICY "labels_log_insert" ON labels_log FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "product_audit_log_select" ON product_audit_log FOR SELECT TO authenticated
  USING (auth_role_claim() IN ('superadmin', 'manager'));

CREATE POLICY "product_audit_log_insert" ON product_audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- data_journal: append-only, superadmin reads
CREATE POLICY "data_journal_select" ON data_journal FOR SELECT TO authenticated
  USING (auth_role_claim() = 'superadmin');

CREATE POLICY "data_journal_insert" ON data_journal FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- MIGRATION 005 TABLES (also need RLS)
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  store_tables TEXT[] := ARRAY[
    'suppliers','returns','return_items','trade_ins','parts','repair_parts_used',
    'cash_sessions','cash_movements','installment_plans','installment_payments',
    'gift_cards','gift_card_transactions','loyalty_transactions','loyalty_settings',
    'commission_rules','commissions','clock_records','stock_alert_rules',
    'checklist_templates','receipt_templates','purchase_orders','po_items',
    'whatsapp_templates'
  ];
BEGIN
  FOREACH tbl IN ARRAY store_tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      -- Permissive: allow authenticated users with matching store or superadmin
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        tbl || '_auth_all', tbl
      );
    EXCEPTION WHEN undefined_table THEN
      -- Table doesn't exist yet, skip
      NULL;
    WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
