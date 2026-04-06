-- Corner Mobile — Migration 005: New Features
-- Adds: suppliers, returns, warranty, trade-ins, parts inventory, cash management,
-- installments, gift cards, loyalty, signatures, commissions, clock, stock alerts,
-- checklists, receipt templates, and more.

-- ============================================================
-- 1. SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  store_id UUID REFERENCES stores(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_store ON suppliers(store_id);

-- ============================================================
-- 2. ALTER EXISTING TABLES
-- ============================================================

-- Products: bin location, warranty, supplier FK
ALTER TABLE products ADD COLUMN IF NOT EXISTS bin_location TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_months INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- Repairs: signature, checklists
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS pre_checklist JSONB DEFAULT '{}';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS post_checklist JSONB DEFAULT '{}';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS pre_photos TEXT[] DEFAULT '{}';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS post_photos TEXT[] DEFAULT '{}';

-- Customers: loyalty, store credit
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'bronze' CHECK (loyalty_tier IN ('bronze', 'silver', 'gold', 'platinum'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS store_credit NUMERIC(10,2) DEFAULT 0;

-- Sales: return reference
ALTER TABLE sales ADD COLUMN IF NOT EXISTS return_id UUID;

-- ============================================================
-- 3. RETURNS & EXCHANGES
-- ============================================================
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  processed_by UUID NOT NULL REFERENCES users(id),
  customer_id UUID REFERENCES customers(id),
  return_type TEXT NOT NULL CHECK (return_type IN ('full', 'partial', 'exchange')),
  reason TEXT NOT NULL,
  reason_category TEXT CHECK (reason_category IN ('defective', 'wrong_item', 'customer_changed_mind', 'warranty', 'other')),
  refund_amount NUMERIC(10,2) NOT NULL CHECK (refund_amount >= 0),
  refund_method TEXT NOT NULL CHECK (refund_method IN ('cash', 'card', 'store_credit', 'exchange')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_returns_sale ON returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_store ON returns(store_id);
CREATE INDEX IF NOT EXISTS idx_returns_created ON returns(created_at);

CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  sale_item_id UUID REFERENCES sale_items(id),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  refund_amount NUMERIC(10,2) NOT NULL CHECK (refund_amount >= 0),
  restocked BOOLEAN DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);

-- ============================================================
-- 4. TRADE-INS / BUYBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  processed_by UUID NOT NULL REFERENCES users(id),
  device_brand TEXT NOT NULL,
  device_model TEXT NOT NULL,
  imei TEXT,
  storage TEXT,
  color TEXT,
  condition TEXT NOT NULL CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
  offered_price NUMERIC(10,2) NOT NULL CHECK (offered_price >= 0),
  ai_suggested_price NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'in_refurbishment', 'listed', 'sold')),
  product_id UUID REFERENCES products(id), -- linked product once accepted and added to stock
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_ins_store ON trade_ins(store_id);
CREATE INDEX IF NOT EXISTS idx_trade_ins_status ON trade_ins(status);
CREATE INDEX IF NOT EXISTS idx_trade_ins_customer ON trade_ins(customer_id);

-- ============================================================
-- 5. PARTS INVENTORY (separate from sales stock)
-- ============================================================
CREATE TABLE IF NOT EXISTS parts_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('screen', 'battery', 'charging_port', 'camera', 'speaker', 'microphone', 'button', 'housing', 'motherboard', 'other')),
  compatible_brands TEXT[] DEFAULT '{}',
  compatible_models TEXT[] DEFAULT '{}',
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity INTEGER DEFAULT 5,
  purchase_price NUMERIC(10,2) NOT NULL CHECK (purchase_price >= 0),
  selling_price NUMERIC(10,2) DEFAULT 0 CHECK (selling_price >= 0),
  supplier_id UUID REFERENCES suppliers(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  bin_location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_parts_store ON parts_inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_parts_category ON parts_inventory(category);

CREATE TABLE IF NOT EXISTS repair_parts_used (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id UUID NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts_inventory(id),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_cost NUMERIC(10,2) NOT NULL CHECK (unit_cost >= 0),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_repair_parts_repair ON repair_parts_used(repair_id);

-- ============================================================
-- 6. CASH MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  opened_by UUID NOT NULL REFERENCES users(id),
  closed_by UUID REFERENCES users(id),
  opening_amount NUMERIC(10,2) NOT NULL CHECK (opening_amount >= 0),
  closing_amount NUMERIC(10,2) CHECK (closing_amount >= 0),
  expected_amount NUMERIC(10,2),
  difference NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_store ON cash_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(status);

CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id),
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('sale', 'return', 'expense', 'deposit', 'withdrawal', 'adjustment')),
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT,
  reference_id TEXT, -- sale_id, return_id, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(session_id);

-- ============================================================
-- 7. INSTALLMENT PLANS (layaway)
-- ============================================================
CREATE TABLE IF NOT EXISTS installment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  created_by UUID NOT NULL REFERENCES users(id),
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount > 0),
  down_payment NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (down_payment >= 0),
  remaining_amount NUMERIC(10,2) NOT NULL CHECK (remaining_amount >= 0),
  num_installments INTEGER NOT NULL CHECK (num_installments >= 2),
  installment_amount NUMERIC(10,2) NOT NULL CHECK (installment_amount > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),
  next_due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_installments_customer ON installment_plans(customer_id);
CREATE INDEX IF NOT EXISTS idx_installments_status ON installment_plans(status);
CREATE INDEX IF NOT EXISTS idx_installments_store ON installment_plans(store_id);

CREATE TABLE IF NOT EXISTS installment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES installment_plans(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'virement')),
  received_by UUID NOT NULL REFERENCES users(id),
  payment_number INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_installment_payments_plan ON installment_payments(plan_id);

-- ============================================================
-- 8. GIFT CARDS
-- ============================================================
CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  initial_amount NUMERIC(10,2) NOT NULL CHECK (initial_amount > 0),
  current_balance NUMERIC(10,2) NOT NULL CHECK (current_balance >= 0),
  customer_id UUID REFERENCES customers(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  created_by UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_store ON gift_cards(store_id);

CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id UUID NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'redemption', 'refund')),
  amount NUMERIC(10,2) NOT NULL,
  sale_id UUID REFERENCES sales(id),
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gc_transactions_card ON gift_card_transactions(gift_card_id);

-- ============================================================
-- 9. LOYALTY PROGRAM
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) UNIQUE,
  points_per_mad NUMERIC(5,2) DEFAULT 1, -- 1 point per 1 MAD spent
  redemption_rate NUMERIC(5,2) DEFAULT 0.1, -- 1 point = 0.1 MAD
  bronze_threshold INTEGER DEFAULT 0,
  silver_threshold INTEGER DEFAULT 500,
  gold_threshold INTEGER DEFAULT 2000,
  platinum_threshold INTEGER DEFAULT 5000,
  enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'bonus', 'adjustment', 'expire')),
  points INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reference_type TEXT, -- 'sale', 'return', 'manual'
  reference_id UUID,
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_store ON loyalty_transactions(store_id);

-- ============================================================
-- 10. DIGITAL SIGNATURES
-- ============================================================
CREATE TABLE IF NOT EXISTS signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id UUID REFERENCES repairs(id),
  customer_id UUID REFERENCES customers(id),
  signature_data TEXT NOT NULL, -- base64 PNG
  signed_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT
);
CREATE INDEX IF NOT EXISTS idx_signatures_repair ON signatures(repair_id);

-- ============================================================
-- 11. COMMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sale_percentage', 'sale_flat', 'repair_percentage', 'repair_flat')),
  rate NUMERIC(5,2) NOT NULL CHECK (rate >= 0),
  min_amount NUMERIC(10,2) DEFAULT 0,
  applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'seller', 'manager')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commission_rules_store ON commission_rules(store_id);

CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  rule_id UUID REFERENCES commission_rules(id),
  type TEXT NOT NULL CHECK (type IN ('sale', 'repair')),
  reference_id UUID NOT NULL, -- sale_id or repair_id
  base_amount NUMERIC(10,2) NOT NULL,
  commission_amount NUMERIC(10,2) NOT NULL CHECK (commission_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commissions_user ON commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_store ON commissions(store_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);

-- ============================================================
-- 12. CLOCK IN/OUT (TIME TRACKING)
-- ============================================================
CREATE TABLE IF NOT EXISTS clock_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  total_hours NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clock_user ON clock_records(user_id);
CREATE INDEX IF NOT EXISTS idx_clock_store ON clock_records(store_id);
CREATE INDEX IF NOT EXISTS idx_clock_in ON clock_records(clock_in);

-- ============================================================
-- 13. PURCHASE ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  created_by UUID NOT NULL REFERENCES users(id),
  po_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial', 'received', 'cancelled')),
  total_amount NUMERIC(10,2) DEFAULT 0 CHECK (total_amount >= 0),
  notes TEXT,
  expected_date DATE,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_store ON purchase_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

CREATE TABLE IF NOT EXISTS po_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('phone', 'accessory', 'part')),
  brand TEXT,
  model TEXT,
  quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered >= 1),
  quantity_received INTEGER DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost NUMERIC(10,2) NOT NULL CHECK (unit_cost >= 0),
  total_cost NUMERIC(10,2) NOT NULL CHECK (total_cost >= 0),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON po_items(po_id);

-- ============================================================
-- 14. STOCK ALERT RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  name TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'aging_stock', 'negative_margin', 'warranty_expiring')),
  product_type TEXT CHECK (product_type IN ('phone', 'accessory', 'part')),
  brand TEXT,
  threshold INTEGER NOT NULL DEFAULT 5,
  enabled BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_store ON stock_alert_rules(store_id);

-- ============================================================
-- 15. CHECKLIST TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  name TEXT NOT NULL DEFAULT 'Standard',
  items JSONB NOT NULL DEFAULT '[]', -- [{key: 'screen', label: 'Ecran', type: 'boolean'}, ...]
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 16. RECEIPT TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS receipt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) UNIQUE,
  header_text TEXT DEFAULT 'Corner Mobile',
  footer_text TEXT DEFAULT 'Merci pour votre achat !',
  show_logo BOOLEAN DEFAULT true,
  show_store_address BOOLEAN DEFAULT true,
  show_seller_name BOOLEAN DEFAULT true,
  show_qr_code BOOLEAN DEFAULT true,
  paper_width TEXT DEFAULT '80mm' CHECK (paper_width IN ('58mm', '80mm')),
  font_size TEXT DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 17. EXPAND data_journal entity_type
-- ============================================================
ALTER TABLE data_journal DROP CONSTRAINT IF EXISTS data_journal_entity_type_check;
ALTER TABLE data_journal ADD CONSTRAINT data_journal_entity_type_check
  CHECK (entity_type IN (
    'product', 'sale', 'repair', 'transfer', 'customer', 'user',
    'return', 'trade_in', 'cash_session', 'cash_movement',
    'installment', 'gift_card', 'loyalty', 'commission',
    'clock', 'supplier', 'purchase_order', 'part', 'checklist'
  ));

-- ============================================================
-- 18. EXPAND notifications type
-- ============================================================
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'repair_ready', 'transfer_received', 'low_stock', 'sale_made',
    'return_processed', 'warranty_expiring', 'payment_due',
    'stock_alert', 'repair_reminder', 'commission_update',
    'trade_in_received', 'whatsapp_sent', 'cash_session',
    'installment_due', 'gift_card_received'
  ));

-- ============================================================
-- SEED: Default checklist template
-- ============================================================
INSERT INTO checklist_templates (id, name, items) VALUES (
  gen_random_uuid(),
  'Standard Smartphone',
  '[
    {"key": "screen", "label": "Ecran (affichage, tactile)", "type": "select", "options": ["OK", "Rayures", "Fissuré", "Ne fonctionne pas"]},
    {"key": "battery", "label": "Batterie", "type": "select", "options": ["OK", "Faible", "Gonflement", "Ne charge pas"]},
    {"key": "charging_port", "label": "Port de charge", "type": "select", "options": ["OK", "Lâche", "Ne fonctionne pas"]},
    {"key": "cameras", "label": "Caméras (avant/arrière)", "type": "select", "options": ["OK", "Floue", "Ne fonctionne pas"]},
    {"key": "speakers", "label": "Haut-parleurs", "type": "select", "options": ["OK", "Faible", "Grésille", "Ne fonctionne pas"]},
    {"key": "microphone", "label": "Microphone", "type": "select", "options": ["OK", "Faible", "Ne fonctionne pas"]},
    {"key": "buttons", "label": "Boutons physiques", "type": "select", "options": ["OK", "Dur", "Bloqué", "Ne fonctionne pas"]},
    {"key": "wifi", "label": "WiFi", "type": "select", "options": ["OK", "Instable", "Ne fonctionne pas"]},
    {"key": "bluetooth", "label": "Bluetooth", "type": "select", "options": ["OK", "Ne fonctionne pas"]},
    {"key": "sim", "label": "SIM / Réseau", "type": "select", "options": ["OK", "Pas de signal", "Ne détecte pas SIM"]},
    {"key": "face_id", "label": "Face ID / Empreinte", "type": "select", "options": ["OK", "Ne fonctionne pas", "N/A"]},
    {"key": "water_damage", "label": "Dégâts eau", "type": "select", "options": ["Aucun", "Indicateur déclenché", "Visible"]}
  ]'
) ON CONFLICT DO NOTHING;
