-- Corner Mobile — Migration 007: Complete RLS + Security Hardening
--
-- 1. Drop permissive USING(true) policies from migration 006 on new tables
-- 2. Create proper store-scoped RLS policies for all 005 tables
-- 3. Add idempotency_key columns on critical tables
-- 4. Create sessions table (revocable JWT sessions)
-- 5. Create user_2fa table
-- 6. Create enhanced audit_log table

BEGIN;

-- ============================================================
-- SECTION 1: DROP PERMISSIVE POLICIES FROM MIGRATION 006
-- ============================================================
-- Migration 006 created "tablename_auth_all" policies with USING(true)
-- on all 005 tables. Drop them before creating proper policies.

DO $$
DECLARE
  tbl TEXT;
  policy_tables TEXT[] := ARRAY[
    'suppliers','returns','return_items','trade_ins','parts_inventory','repair_parts_used',
    'cash_sessions','cash_movements','installment_plans','installment_payments',
    'gift_cards','gift_card_transactions','loyalty_transactions','loyalty_settings',
    'commission_rules','commissions','clock_records','stock_alert_rules',
    'checklist_templates','receipt_templates','purchase_orders','po_items',
    'signatures','whatsapp_templates'
  ];
BEGIN
  FOREACH tbl IN ARRAY policy_tables LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_auth_all', tbl);
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Also drop the old "parts" alias if migration 006 used that name
DROP POLICY IF EXISTS "parts_auth_all" ON parts_inventory;


-- ============================================================
-- SECTION 2: PROPER RLS POLICIES FOR ALL 005 TABLES
-- ============================================================

-- ----------------------------------------------------------
-- SUPPLIERS (store_id nullable — NULL = global supplier)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;

CREATE POLICY "suppliers_select" ON suppliers FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id IS NULL
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id IS NULL OR store_id::text = auth_store_id())
  );

CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id IS NULL OR store_id::text = auth_store_id())
  );

CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- RETURNS (has store_id)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "returns_select" ON returns;
DROP POLICY IF EXISTS "returns_insert" ON returns;
DROP POLICY IF EXISTS "returns_update" ON returns;
DROP POLICY IF EXISTS "returns_delete" ON returns;

CREATE POLICY "returns_select" ON returns FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "returns_insert" ON returns FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "returns_update" ON returns FOR UPDATE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "returns_delete" ON returns FOR DELETE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- RETURN_ITEMS (no store_id — join to returns)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "return_items_select" ON return_items;
DROP POLICY IF EXISTS "return_items_insert" ON return_items;
DROP POLICY IF EXISTS "return_items_delete" ON return_items;

CREATE POLICY "return_items_select" ON return_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM returns r
      WHERE r.id = return_items.return_id
      AND (auth_role_claim() = 'superadmin' OR r.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "return_items_insert" ON return_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM returns r
      WHERE r.id = return_items.return_id
      AND (auth_role_claim() = 'superadmin' OR r.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "return_items_delete" ON return_items FOR DELETE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND EXISTS (
      SELECT 1 FROM returns r
      WHERE r.id = return_items.return_id
      AND (auth_role_claim() = 'superadmin' OR r.store_id::text = auth_store_id())
    )
  );

-- ----------------------------------------------------------
-- TRADE_INS (has store_id)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "trade_ins_select" ON trade_ins;
DROP POLICY IF EXISTS "trade_ins_insert" ON trade_ins;
DROP POLICY IF EXISTS "trade_ins_update" ON trade_ins;
DROP POLICY IF EXISTS "trade_ins_delete" ON trade_ins;

CREATE POLICY "trade_ins_select" ON trade_ins FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "trade_ins_insert" ON trade_ins FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "trade_ins_update" ON trade_ins FOR UPDATE TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "trade_ins_delete" ON trade_ins FOR DELETE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- PARTS_INVENTORY (has store_id)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "parts_inventory_select" ON parts_inventory;
DROP POLICY IF EXISTS "parts_inventory_insert" ON parts_inventory;
DROP POLICY IF EXISTS "parts_inventory_update" ON parts_inventory;
DROP POLICY IF EXISTS "parts_inventory_delete" ON parts_inventory;

CREATE POLICY "parts_inventory_select" ON parts_inventory FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "parts_inventory_insert" ON parts_inventory FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "parts_inventory_update" ON parts_inventory FOR UPDATE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "parts_inventory_delete" ON parts_inventory FOR DELETE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- REPAIR_PARTS_USED (no store_id — join to repairs)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "repair_parts_used_select" ON repair_parts_used;
DROP POLICY IF EXISTS "repair_parts_used_insert" ON repair_parts_used;
DROP POLICY IF EXISTS "repair_parts_used_delete" ON repair_parts_used;

CREATE POLICY "repair_parts_used_select" ON repair_parts_used FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM repairs r
      WHERE r.id = repair_parts_used.repair_id
      AND (auth_role_claim() = 'superadmin' OR r.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "repair_parts_used_insert" ON repair_parts_used FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM repairs r
      WHERE r.id = repair_parts_used.repair_id
      AND (auth_role_claim() = 'superadmin' OR r.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "repair_parts_used_delete" ON repair_parts_used FOR DELETE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND EXISTS (
      SELECT 1 FROM repairs r
      WHERE r.id = repair_parts_used.repair_id
      AND (auth_role_claim() = 'superadmin' OR r.store_id::text = auth_store_id())
    )
  );

-- ----------------------------------------------------------
-- CASH_SESSIONS (has store_id)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "cash_sessions_select" ON cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_insert" ON cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_update" ON cash_sessions;

CREATE POLICY "cash_sessions_select" ON cash_sessions FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "cash_sessions_insert" ON cash_sessions FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "cash_sessions_update" ON cash_sessions FOR UPDATE TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

-- ----------------------------------------------------------
-- CASH_MOVEMENTS (has store_id)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "cash_movements_select" ON cash_movements;
DROP POLICY IF EXISTS "cash_movements_insert" ON cash_movements;

CREATE POLICY "cash_movements_select" ON cash_movements FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "cash_movements_insert" ON cash_movements FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

-- ----------------------------------------------------------
-- INSTALLMENT_PLANS (has store_id)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "installment_plans_select" ON installment_plans;
DROP POLICY IF EXISTS "installment_plans_insert" ON installment_plans;
DROP POLICY IF EXISTS "installment_plans_update" ON installment_plans;

CREATE POLICY "installment_plans_select" ON installment_plans FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "installment_plans_insert" ON installment_plans FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "installment_plans_update" ON installment_plans FOR UPDATE TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

-- ----------------------------------------------------------
-- INSTALLMENT_PAYMENTS (no store_id — join to installment_plans)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "installment_payments_select" ON installment_payments;
DROP POLICY IF EXISTS "installment_payments_insert" ON installment_payments;

CREATE POLICY "installment_payments_select" ON installment_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM installment_plans ip
      WHERE ip.id = installment_payments.plan_id
      AND (auth_role_claim() = 'superadmin' OR ip.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "installment_payments_insert" ON installment_payments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM installment_plans ip
      WHERE ip.id = installment_payments.plan_id
      AND (auth_role_claim() = 'superadmin' OR ip.store_id::text = auth_store_id())
    )
  );

-- ----------------------------------------------------------
-- GIFT_CARDS (has store_id)
-- Global SELECT for check/redeem, store-scoped for management
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "gift_cards_select" ON gift_cards;
DROP POLICY IF EXISTS "gift_cards_insert" ON gift_cards;
DROP POLICY IF EXISTS "gift_cards_update" ON gift_cards;
DROP POLICY IF EXISTS "gift_cards_delete" ON gift_cards;

-- Any authenticated user can look up a gift card (for redemption at any store)
CREATE POLICY "gift_cards_select" ON gift_cards FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "gift_cards_insert" ON gift_cards FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "gift_cards_update" ON gift_cards FOR UPDATE TO authenticated
  USING (
    -- Superadmin: full management; others: can update any card (for redemption balance changes)
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
    -- Allow cross-store redemption updates (balance deduction)
    OR auth_role_claim() IN ('manager', 'seller')
  );

CREATE POLICY "gift_cards_delete" ON gift_cards FOR DELETE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- GIFT_CARD_TRANSACTIONS (no store_id — join to gift_cards)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "gift_card_transactions_select" ON gift_card_transactions;
DROP POLICY IF EXISTS "gift_card_transactions_insert" ON gift_card_transactions;

-- Globally visible (needed for cross-store redemption history)
CREATE POLICY "gift_card_transactions_select" ON gift_card_transactions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "gift_card_transactions_insert" ON gift_card_transactions FOR INSERT TO authenticated
  WITH CHECK (true);

-- ----------------------------------------------------------
-- LOYALTY_SETTINGS (has store_id, one per store)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "loyalty_settings_select" ON loyalty_settings;
DROP POLICY IF EXISTS "loyalty_settings_insert" ON loyalty_settings;
DROP POLICY IF EXISTS "loyalty_settings_update" ON loyalty_settings;

CREATE POLICY "loyalty_settings_select" ON loyalty_settings FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "loyalty_settings_insert" ON loyalty_settings FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "loyalty_settings_update" ON loyalty_settings FOR UPDATE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- LOYALTY_TRANSACTIONS (has store_id)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "loyalty_transactions_select" ON loyalty_transactions;
DROP POLICY IF EXISTS "loyalty_transactions_insert" ON loyalty_transactions;

CREATE POLICY "loyalty_transactions_select" ON loyalty_transactions FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "loyalty_transactions_insert" ON loyalty_transactions FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

-- ----------------------------------------------------------
-- COMMISSION_RULES (has store_id)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "commission_rules_select" ON commission_rules;
DROP POLICY IF EXISTS "commission_rules_insert" ON commission_rules;
DROP POLICY IF EXISTS "commission_rules_update" ON commission_rules;
DROP POLICY IF EXISTS "commission_rules_delete" ON commission_rules;

CREATE POLICY "commission_rules_select" ON commission_rules FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "commission_rules_insert" ON commission_rules FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "commission_rules_update" ON commission_rules FOR UPDATE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "commission_rules_delete" ON commission_rules FOR DELETE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- COMMISSIONS (has store_id)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "commissions_select" ON commissions;
DROP POLICY IF EXISTS "commissions_insert" ON commissions;
DROP POLICY IF EXISTS "commissions_update" ON commissions;

CREATE POLICY "commissions_select" ON commissions FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "commissions_insert" ON commissions FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "commissions_update" ON commissions FOR UPDATE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- CLOCK_RECORDS (has store_id)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "clock_records_select" ON clock_records;
DROP POLICY IF EXISTS "clock_records_insert" ON clock_records;
DROP POLICY IF EXISTS "clock_records_update" ON clock_records;

CREATE POLICY "clock_records_select" ON clock_records FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "clock_records_insert" ON clock_records FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "clock_records_update" ON clock_records FOR UPDATE TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

-- ----------------------------------------------------------
-- STOCK_ALERT_RULES (has store_id)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "stock_alert_rules_select" ON stock_alert_rules;
DROP POLICY IF EXISTS "stock_alert_rules_insert" ON stock_alert_rules;
DROP POLICY IF EXISTS "stock_alert_rules_update" ON stock_alert_rules;
DROP POLICY IF EXISTS "stock_alert_rules_delete" ON stock_alert_rules;

CREATE POLICY "stock_alert_rules_select" ON stock_alert_rules FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "stock_alert_rules_insert" ON stock_alert_rules FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "stock_alert_rules_update" ON stock_alert_rules FOR UPDATE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "stock_alert_rules_delete" ON stock_alert_rules FOR DELETE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- CHECKLIST_TEMPLATES (store_id nullable — NULL = global template)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "checklist_templates_select" ON checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_insert" ON checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_update" ON checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_delete" ON checklist_templates;

-- Global templates (store_id IS NULL) visible to all; store-specific visible to that store
CREATE POLICY "checklist_templates_select" ON checklist_templates FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id IS NULL
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "checklist_templates_insert" ON checklist_templates FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id IS NULL OR store_id::text = auth_store_id())
  );

CREATE POLICY "checklist_templates_update" ON checklist_templates FOR UPDATE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id IS NULL OR store_id::text = auth_store_id())
  );

CREATE POLICY "checklist_templates_delete" ON checklist_templates FOR DELETE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- RECEIPT_TEMPLATES (has store_id, one per store)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "receipt_templates_select" ON receipt_templates;
DROP POLICY IF EXISTS "receipt_templates_insert" ON receipt_templates;
DROP POLICY IF EXISTS "receipt_templates_update" ON receipt_templates;

CREATE POLICY "receipt_templates_select" ON receipt_templates FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "receipt_templates_insert" ON receipt_templates FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "receipt_templates_update" ON receipt_templates FOR UPDATE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- PURCHASE_ORDERS (has store_id)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "purchase_orders_select" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_insert" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_update" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_delete" ON purchase_orders;

CREATE POLICY "purchase_orders_select" ON purchase_orders FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR store_id::text = auth_store_id()
  );

CREATE POLICY "purchase_orders_insert" ON purchase_orders FOR INSERT TO authenticated
  WITH CHECK (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "purchase_orders_update" ON purchase_orders FOR UPDATE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

CREATE POLICY "purchase_orders_delete" ON purchase_orders FOR DELETE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND (auth_role_claim() = 'superadmin' OR store_id::text = auth_store_id())
  );

-- ----------------------------------------------------------
-- PO_ITEMS (no store_id — join to purchase_orders)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "po_items_select" ON po_items;
DROP POLICY IF EXISTS "po_items_insert" ON po_items;
DROP POLICY IF EXISTS "po_items_update" ON po_items;
DROP POLICY IF EXISTS "po_items_delete" ON po_items;

CREATE POLICY "po_items_select" ON po_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_items.po_id
      AND (auth_role_claim() = 'superadmin' OR po.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "po_items_insert" ON po_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_items.po_id
      AND (auth_role_claim() = 'superadmin' OR po.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "po_items_update" ON po_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_items.po_id
      AND (auth_role_claim() = 'superadmin' OR po.store_id::text = auth_store_id())
    )
  );

CREATE POLICY "po_items_delete" ON po_items FOR DELETE TO authenticated
  USING (
    auth_role_claim() IN ('superadmin', 'manager')
    AND EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_items.po_id
      AND (auth_role_claim() = 'superadmin' OR po.store_id::text = auth_store_id())
    )
  );

-- ----------------------------------------------------------
-- SIGNATURES (no store_id — visible to all authenticated)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "signatures_select" ON signatures;
DROP POLICY IF EXISTS "signatures_insert" ON signatures;

CREATE POLICY "signatures_select" ON signatures FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "signatures_insert" ON signatures FOR INSERT TO authenticated
  WITH CHECK (true);


-- ============================================================
-- SECTION 3: IDEMPOTENCY KEYS
-- ============================================================
-- Add idempotency_key column to critical mutation tables.
-- Prevents duplicate submissions from retries / flaky network.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_idempotency_key_unique'
  ) THEN
    ALTER TABLE sales ADD CONSTRAINT sales_idempotency_key_unique UNIQUE (idempotency_key);
  END IF;
END $$;

ALTER TABLE returns ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'returns_idempotency_key_unique'
  ) THEN
    ALTER TABLE returns ADD CONSTRAINT returns_idempotency_key_unique UNIQUE (idempotency_key);
  END IF;
END $$;

ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_movements_idempotency_key_unique'
  ) THEN
    ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_idempotency_key_unique UNIQUE (idempotency_key);
  END IF;
END $$;

ALTER TABLE transfers ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfers_idempotency_key_unique'
  ) THEN
    ALTER TABLE transfers ADD CONSTRAINT transfers_idempotency_key_unique UNIQUE (idempotency_key);
  END IF;
END $$;

ALTER TABLE repairs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'repairs_idempotency_key_unique'
  ) THEN
    ALTER TABLE repairs ADD CONSTRAINT repairs_idempotency_key_unique UNIQUE (idempotency_key);
  END IF;
END $$;


-- ============================================================
-- SECTION 4: SESSIONS TABLE (revocable JWT sessions)
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jti TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_jti ON sessions(jti);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at) WHERE revoked_at IS NULL;

-- RLS for sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_select" ON sessions;
DROP POLICY IF EXISTS "sessions_insert" ON sessions;
DROP POLICY IF EXISTS "sessions_update" ON sessions;
DROP POLICY IF EXISTS "sessions_delete" ON sessions;

-- Users can see their own sessions; superadmin sees all
CREATE POLICY "sessions_select" ON sessions FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR user_id::text = auth_user_id()
  );

-- Service role handles insert (via API routes), but allow authenticated for direct use
CREATE POLICY "sessions_insert" ON sessions FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users can revoke their own sessions; superadmin can revoke any
CREATE POLICY "sessions_update" ON sessions FOR UPDATE TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR user_id::text = auth_user_id()
  );

-- Superadmin can delete sessions
CREATE POLICY "sessions_delete" ON sessions FOR DELETE TO authenticated
  USING (auth_role_claim() = 'superadmin');


-- ============================================================
-- SECTION 5: USER_2FA TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS user_2fa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  secret_encrypted TEXT NOT NULL,
  recovery_codes TEXT[] NOT NULL,
  enabled BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_2fa_user ON user_2fa(user_id);

-- RLS for user_2fa
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_2fa_select" ON user_2fa;
DROP POLICY IF EXISTS "user_2fa_insert" ON user_2fa;
DROP POLICY IF EXISTS "user_2fa_update" ON user_2fa;
DROP POLICY IF EXISTS "user_2fa_delete" ON user_2fa;

-- Users can only see/manage their own 2FA; superadmin can see all (for support)
CREATE POLICY "user_2fa_select" ON user_2fa FOR SELECT TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR user_id::text = auth_user_id()
  );

CREATE POLICY "user_2fa_insert" ON user_2fa FOR INSERT TO authenticated
  WITH CHECK (
    user_id::text = auth_user_id()
  );

CREATE POLICY "user_2fa_update" ON user_2fa FOR UPDATE TO authenticated
  USING (
    user_id::text = auth_user_id()
  );

CREATE POLICY "user_2fa_delete" ON user_2fa FOR DELETE TO authenticated
  USING (
    auth_role_claim() = 'superadmin'
    OR user_id::text = auth_user_id()
  );


-- ============================================================
-- SECTION 6: ENHANCED AUDIT_LOG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,  -- nullable for now (single-org)
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before JSONB,
  after JSONB,
  ip TEXT,
  user_agent TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_request ON audit_log(request_id) WHERE request_id IS NOT NULL;

-- RLS for audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;

-- Only superadmin and managers can read audit logs
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT TO authenticated
  USING (auth_role_claim() IN ('superadmin', 'manager'));

-- Any authenticated user can write audit entries (triggered by their actions)
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT TO authenticated
  WITH CHECK (true);


COMMIT;
