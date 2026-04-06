// Corner Mobile — Type definitions

export type UserRole = 'superadmin' | 'manager' | 'seller';

export type ProductType = 'phone' | 'accessory' | 'part';

export type ProductCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';

export type ProductStatus = 'in_stock' | 'sold' | 'in_repair' | 'transferred' | 'returned';

export type PaymentMethod = 'cash' | 'card' | 'virement' | 'mixte' | 'store_credit' | 'gift_card' | 'installment';

export type RepairStatus = 'received' | 'diagnosing' | 'waiting_parts' | 'in_repair' | 'ready' | 'delivered' | 'cancelled';

export type ReturnType = 'full' | 'partial' | 'exchange';
export type ReturnReason = 'defective' | 'wrong_item' | 'customer_changed_mind' | 'warranty' | 'other';
export type RefundMethod = 'cash' | 'card' | 'store_credit' | 'exchange';

export type TradeInStatus = 'pending' | 'accepted' | 'rejected' | 'in_refurbishment' | 'listed' | 'sold';

export type PartCategory = 'screen' | 'battery' | 'charging_port' | 'camera' | 'speaker' | 'microphone' | 'button' | 'housing' | 'motherboard' | 'other';

export type CashMovementType = 'sale' | 'return' | 'expense' | 'deposit' | 'withdrawal' | 'adjustment';

export type InstallmentStatus = 'active' | 'completed' | 'defaulted' | 'cancelled';

export type GiftCardStatus = 'active' | 'used' | 'expired' | 'cancelled';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type LoyaltyTransactionType = 'earn' | 'redeem' | 'bonus' | 'adjustment' | 'expire';

export type CommissionType = 'sale' | 'repair';
export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'cancelled';

export type POStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';

export type AlertType = 'low_stock' | 'aging_stock' | 'negative_margin' | 'warranty_expiring';

export type NotificationType =
  | 'repair_ready' | 'transfer_received' | 'low_stock' | 'sale_made'
  | 'return_processed' | 'warranty_expiring' | 'payment_due'
  | 'stock_alert' | 'repair_reminder' | 'commission_update'
  | 'trade_in_received' | 'whatsapp_sent' | 'cash_session'
  | 'installment_due' | 'gift_card_received';

export interface Store {
  id: string;
  name: string;
  location: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  store_id: string;
  avatar_url?: string;
  created_at: string;
  store?: Store;
}

export interface Product {
  id: string;
  imei?: string;
  product_type: ProductType;
  brand: string;
  model: string;
  storage?: string;
  color?: string;
  condition: ProductCondition;
  purchase_price: number;
  selling_price: number;
  status: ProductStatus;
  store_id: string;
  supplier?: string;
  supplier_id?: string;
  purchase_date?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  store?: Store;
  // New fields
  bin_location?: string;
  warranty_months?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  created_at: string;
  // New loyalty fields
  loyalty_tier?: LoyaltyTier;
  loyalty_points?: number;
  store_credit?: number;
}

export interface Sale {
  id: string;
  store_id: string;
  seller_id: string;
  customer_id?: string;
  total: number;
  discount_amount: number;
  discount_type?: 'flat' | 'percentage';
  payment_method: PaymentMethod;
  payment_details?: Record<string, number>;
  created_at: string;
  seller?: User;
  customer?: Customer;
  items?: SaleItem[];
  return_id?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  original_price: number;
  product?: Product;
}

export interface Repair {
  id: string;
  customer_id: string;
  store_id: string;
  technician_id?: string;
  device_brand: string;
  device_model: string;
  imei?: string;
  problem: string;
  problem_categories: string[];
  condition_on_arrival?: string;
  status: RepairStatus;
  estimated_cost: number;
  final_cost?: number;
  deposit: number;
  estimated_completion_date?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  technician?: User;
  status_logs?: RepairStatusLog[];
  // New fields
  signature_url?: string;
  pre_checklist?: Record<string, string>;
  post_checklist?: Record<string, string>;
  pre_photos?: string[];
  post_photos?: string[];
  parts_used?: RepairPartUsed[];
}

export interface RepairStatusLog {
  id: string;
  repair_id: string;
  status: RepairStatus;
  changed_by: string;
  changed_at: string;
  notes?: string;
  user?: User;
}

export interface Transfer {
  id: string;
  product_id: string;
  from_store_id: string;
  to_store_id: string;
  initiated_by: string;
  created_at: string;
  product?: Product;
  from_store?: Store;
  to_store?: Store;
  initiator?: User;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, unknown>;
  created_at: string;
}

export interface AiLog {
  id: string;
  feature: string;
  prompt: string;
  response: string;
  user_id: string;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  original_price: number;
}

export interface LabelData {
  product: Product;
  store_name: string;
}

// ============================================================
// NEW FEATURE TYPES
// ============================================================

// Returns & Exchanges
export interface Return {
  id: string;
  sale_id: string;
  store_id: string;
  processed_by: string;
  customer_id?: string;
  return_type: ReturnType;
  reason: string;
  reason_category?: ReturnReason;
  refund_amount: number;
  refund_method: RefundMethod;
  notes?: string;
  created_at: string;
  sale?: Sale;
  customer?: Customer;
  items?: ReturnItem[];
  processor?: User;
}

export interface ReturnItem {
  id: string;
  return_id: string;
  product_id: string;
  sale_item_id?: string;
  quantity: number;
  refund_amount: number;
  restocked: boolean;
  product?: Product;
}

// Trade-in / Buyback
export interface TradeIn {
  id: string;
  customer_id?: string;
  store_id: string;
  processed_by: string;
  device_brand: string;
  device_model: string;
  imei?: string;
  storage?: string;
  color?: string;
  condition: ProductCondition;
  offered_price: number;
  ai_suggested_price?: number;
  status: TradeInStatus;
  product_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  processor?: User;
  product?: Product;
}

// Parts Inventory
export interface Part {
  id: string;
  name: string;
  category: PartCategory;
  compatible_brands: string[];
  compatible_models: string[];
  sku?: string;
  quantity: number;
  min_quantity: number;
  purchase_price: number;
  selling_price: number;
  supplier_id?: string;
  store_id: string;
  bin_location?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
}

export interface RepairPartUsed {
  id: string;
  repair_id: string;
  part_id: string;
  quantity: number;
  unit_cost: number;
  created_at: string;
  part?: Part;
}

// Cash Management
export interface CashSession {
  id: string;
  store_id: string;
  opened_by: string;
  closed_by?: string;
  opening_amount: number;
  closing_amount?: number;
  expected_amount?: number;
  difference?: number;
  status: 'open' | 'closed';
  notes?: string;
  opened_at: string;
  closed_at?: string;
  opener?: User;
  closer?: User;
  movements?: CashMovement[];
}

export interface CashMovement {
  id: string;
  session_id: string;
  store_id: string;
  user_id: string;
  type: CashMovementType;
  amount: number;
  reason?: string;
  reference_id?: string;
  created_at: string;
  user?: User;
}

// Installments
export interface InstallmentPlan {
  id: string;
  sale_id: string;
  customer_id: string;
  store_id: string;
  created_by: string;
  total_amount: number;
  down_payment: number;
  remaining_amount: number;
  num_installments: number;
  installment_amount: number;
  status: InstallmentStatus;
  next_due_date?: string;
  notes?: string;
  created_at: string;
  customer?: Customer;
  sale?: Sale;
  payments?: InstallmentPayment[];
}

export interface InstallmentPayment {
  id: string;
  plan_id: string;
  amount: number;
  payment_method: 'cash' | 'card' | 'virement';
  received_by: string;
  payment_number: number;
  notes?: string;
  created_at: string;
  receiver?: User;
}

// Gift Cards
export interface GiftCard {
  id: string;
  code: string;
  initial_amount: number;
  current_balance: number;
  customer_id?: string;
  store_id: string;
  created_by: string;
  status: GiftCardStatus;
  expires_at?: string;
  created_at: string;
  customer?: Customer;
}

export interface GiftCardTransaction {
  id: string;
  gift_card_id: string;
  type: 'purchase' | 'redemption' | 'refund';
  amount: number;
  sale_id?: string;
  user_id: string;
  created_at: string;
}

// Loyalty
export interface LoyaltySettings {
  id: string;
  store_id: string;
  points_per_mad: number;
  redemption_rate: number;
  bronze_threshold: number;
  silver_threshold: number;
  gold_threshold: number;
  platinum_threshold: number;
  enabled: boolean;
  updated_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  store_id: string;
  type: LoyaltyTransactionType;
  points: number;
  balance_after: number;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  created_by?: string;
  created_at: string;
}

// Signatures
export interface Signature {
  id: string;
  repair_id?: string;
  customer_id?: string;
  signature_data: string; // base64 PNG
  signed_at: string;
}

// Commissions
export interface CommissionRule {
  id: string;
  store_id: string;
  name: string;
  type: 'sale_percentage' | 'sale_flat' | 'repair_percentage' | 'repair_flat';
  rate: number;
  min_amount: number;
  applies_to: 'all' | 'seller' | 'manager';
  active: boolean;
  created_at: string;
}

export interface Commission {
  id: string;
  user_id: string;
  store_id: string;
  rule_id?: string;
  type: CommissionType;
  reference_id: string;
  base_amount: number;
  commission_amount: number;
  status: CommissionStatus;
  paid_at?: string;
  created_at: string;
  user?: User;
  rule?: CommissionRule;
}

// Clock In/Out
export interface ClockRecord {
  id: string;
  user_id: string;
  store_id: string;
  clock_in: string;
  clock_out?: string;
  break_minutes: number;
  total_hours?: number;
  notes?: string;
  created_at: string;
  user?: User;
}

// Suppliers
export interface Supplier {
  id: string;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  store_id?: string;
  created_by?: string;
  created_at: string;
}

// Purchase Orders
export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  store_id: string;
  created_by: string;
  po_number: string;
  status: POStatus;
  total_amount: number;
  notes?: string;
  expected_date?: string;
  received_at?: string;
  created_at: string;
  supplier?: Supplier;
  items?: POItem[];
  creator?: User;
}

export interface POItem {
  id: string;
  po_id: string;
  description: string;
  product_type: ProductType;
  brand?: string;
  model?: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
  notes?: string;
}

// Stock Alert Rules
export interface StockAlertRule {
  id: string;
  store_id: string;
  name: string;
  alert_type: AlertType;
  product_type?: ProductType;
  brand?: string;
  threshold: number;
  enabled: boolean;
  created_by: string;
  created_at: string;
}

// Checklist Templates
export interface ChecklistTemplate {
  id: string;
  store_id?: string;
  name: string;
  items: ChecklistItem[];
  active: boolean;
  created_at: string;
}

export interface ChecklistItem {
  key: string;
  label: string;
  type: 'boolean' | 'select' | 'text';
  options?: string[];
}

// Receipt Templates
export interface ReceiptTemplate {
  id: string;
  store_id: string;
  header_text: string;
  footer_text: string;
  show_logo: boolean;
  show_store_address: boolean;
  show_seller_name: boolean;
  show_qr_code: boolean;
  paper_width: '58mm' | '80mm';
  font_size: 'small' | 'medium' | 'large';
  updated_at: string;
}
