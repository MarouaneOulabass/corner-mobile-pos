-- Corner Mobile — Database Hardening

-- Non-negative price constraints
ALTER TABLE products ADD CONSTRAINT chk_purchase_price_positive CHECK (purchase_price >= 0);
ALTER TABLE products ADD CONSTRAINT chk_selling_price_positive CHECK (selling_price >= 0);

-- Non-negative sale amounts
ALTER TABLE sales ADD CONSTRAINT chk_sale_total_positive CHECK (total >= 0);
ALTER TABLE sales ADD CONSTRAINT chk_discount_positive CHECK (discount_amount >= 0);

-- Positive quantities
ALTER TABLE sale_items ADD CONSTRAINT chk_quantity_positive CHECK (quantity >= 1);
ALTER TABLE sale_items ADD CONSTRAINT chk_unit_price_positive CHECK (unit_price >= 0);

-- Non-negative repair costs
ALTER TABLE repairs ADD CONSTRAINT chk_estimated_cost_positive CHECK (estimated_cost >= 0);
ALTER TABLE repairs ADD CONSTRAINT chk_deposit_positive CHECK (deposit >= 0);
ALTER TABLE repairs ADD CONSTRAINT chk_final_cost_positive CHECK (final_cost IS NULL OR final_cost >= 0);

-- Users must have a store
ALTER TABLE users ALTER COLUMN store_id SET NOT NULL;

-- Product audit log table
CREATE TABLE IF NOT EXISTS product_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'status_change')),
  changed_by UUID NOT NULL REFERENCES users(id),
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_audit_product_id ON product_audit_log(product_id);
CREATE INDEX IF NOT EXISTS idx_product_audit_changed_at ON product_audit_log(changed_at);
