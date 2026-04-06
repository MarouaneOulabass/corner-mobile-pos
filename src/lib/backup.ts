import { createServiceClient } from './supabase';

/**
 * Double-write backup system.
 * Every critical operation (sale, repair, product change, transfer) is written
 * to a `data_journal` table as a JSON event. This journal serves as:
 * 1. An audit trail for every operation
 * 2. A recovery source if the app is rebuilt or the schema changes
 * 3. A way to replay operations to rebuild state from scratch
 *
 * Events are append-only and never deleted.
 */

export type EventType =
  | 'product_created'
  | 'product_updated'
  | 'product_deleted'
  | 'sale_created'
  | 'sale_item_added'
  | 'repair_created'
  | 'repair_status_changed'
  | 'repair_completed'
  | 'transfer_created'
  | 'customer_created'
  | 'customer_updated'
  | 'user_login'
  | 'stock_imported'
  // New feature events
  | 'return_created'
  | 'return_item_restocked'
  | 'trade_in_created'
  | 'trade_in_accepted'
  | 'trade_in_rejected'
  | 'trade_in_status_changed'
  | 'cash_session_opened'
  | 'cash_session_closed'
  | 'cash_movement_created'
  | 'installment_plan_created'
  | 'installment_payment_received'
  | 'installment_completed'
  | 'gift_card_created'
  | 'gift_card_redeemed'
  | 'gift_card_refunded'
  | 'loyalty_earned'
  | 'loyalty_redeemed'
  | 'loyalty_adjusted'
  | 'commission_created'
  | 'commission_paid'
  | 'clock_in'
  | 'clock_out'
  | 'supplier_created'
  | 'supplier_updated'
  | 'purchase_order_created'
  | 'purchase_order_received'
  | 'part_created'
  | 'part_updated'
  | 'part_used_in_repair'
  | 'checklist_completed'
  | 'signature_captured'
  | 'whatsapp_sent';

export type EntityType =
  | 'product' | 'sale' | 'repair' | 'transfer' | 'customer' | 'user'
  | 'return' | 'trade_in' | 'cash_session' | 'cash_movement'
  | 'installment' | 'gift_card' | 'loyalty' | 'commission'
  | 'clock' | 'supplier' | 'purchase_order' | 'part' | 'checklist';

interface JournalEntry {
  event_type: EventType;
  entity_id: string;
  entity_type: EntityType;
  user_id: string;
  store_id?: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Write an event to the data journal.
 * Fire-and-forget — never blocks the main operation.
 */
export async function journalWrite(entry: JournalEntry): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('data_journal').insert({
      event_type: entry.event_type,
      entity_id: entry.entity_id,
      entity_type: entry.entity_type,
      user_id: entry.user_id,
      store_id: entry.store_id || null,
      data: entry.data,
      metadata: entry.metadata || null,
    });
  } catch {
    // Journal write must never crash the main operation
    // In production, this should log to an external service
  }
}

/**
 * Batch write multiple events (for bulk imports).
 */
export async function journalWriteBatch(entries: JournalEntry[]): Promise<void> {
  try {
    const supabase = createServiceClient();
    const rows = entries.map(entry => ({
      event_type: entry.event_type,
      entity_id: entry.entity_id,
      entity_type: entry.entity_type,
      user_id: entry.user_id,
      store_id: entry.store_id || null,
      data: entry.data,
      metadata: entry.metadata || null,
    }));
    await supabase.from('data_journal').insert(rows);
  } catch {
    // Never crash the main operation
  }
}

/**
 * Export the full journal as JSON (for backup/migration).
 */
export async function journalExport(fromDate?: string): Promise<Record<string, unknown>[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from('data_journal')
    .select('*')
    .order('created_at', { ascending: true });

  if (fromDate) {
    query = query.gte('created_at', fromDate);
  }

  const { data } = await query;
  return data || [];
}

/**
 * Get a snapshot of all current data for full backup.
 */
export async function fullSnapshot(): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();

  const [
    stores, users, products, customers, sales, saleItems,
    repairs, repairLogs, transfers,
    // New tables
    returns, returnItems, tradeIns, partsInventory, repairPartsUsed,
    cashSessions, cashMovements, installmentPlans, installmentPayments,
    giftCards, giftCardTx, loyaltySettings, loyaltyTx,
    signatures, commissionRules, commissions, clockRecords,
    suppliers, purchaseOrders, poItems, stockAlertRules,
    checklistTemplates, receiptTemplates,
  ] = await Promise.all([
    supabase.from('stores').select('*'),
    supabase.from('users').select('id, email, name, role, store_id, created_at'),
    supabase.from('products').select('*'),
    supabase.from('customers').select('*'),
    supabase.from('sales').select('*'),
    supabase.from('sale_items').select('*'),
    supabase.from('repairs').select('*'),
    supabase.from('repair_status_log').select('*'),
    supabase.from('transfers').select('*'),
    // New tables
    supabase.from('returns').select('*'),
    supabase.from('return_items').select('*'),
    supabase.from('trade_ins').select('*'),
    supabase.from('parts_inventory').select('*'),
    supabase.from('repair_parts_used').select('*'),
    supabase.from('cash_sessions').select('*'),
    supabase.from('cash_movements').select('*'),
    supabase.from('installment_plans').select('*'),
    supabase.from('installment_payments').select('*'),
    supabase.from('gift_cards').select('*'),
    supabase.from('gift_card_transactions').select('*'),
    supabase.from('loyalty_settings').select('*'),
    supabase.from('loyalty_transactions').select('*'),
    supabase.from('signatures').select('*'),
    supabase.from('commission_rules').select('*'),
    supabase.from('commissions').select('*'),
    supabase.from('clock_records').select('*'),
    supabase.from('suppliers').select('*'),
    supabase.from('purchase_orders').select('*'),
    supabase.from('po_items').select('*'),
    supabase.from('stock_alert_rules').select('*'),
    supabase.from('checklist_templates').select('*'),
    supabase.from('receipt_templates').select('*'),
  ]);

  return {
    exported_at: new Date().toISOString(),
    version: '2.0',
    stores: stores.data || [],
    users: users.data || [],
    products: products.data || [],
    customers: customers.data || [],
    sales: sales.data || [],
    sale_items: saleItems.data || [],
    repairs: repairs.data || [],
    repair_status_log: repairLogs.data || [],
    transfers: transfers.data || [],
    // New tables
    returns: returns.data || [],
    return_items: returnItems.data || [],
    trade_ins: tradeIns.data || [],
    parts_inventory: partsInventory.data || [],
    repair_parts_used: repairPartsUsed.data || [],
    cash_sessions: cashSessions.data || [],
    cash_movements: cashMovements.data || [],
    installment_plans: installmentPlans.data || [],
    installment_payments: installmentPayments.data || [],
    gift_cards: giftCards.data || [],
    gift_card_transactions: giftCardTx.data || [],
    loyalty_settings: loyaltySettings.data || [],
    loyalty_transactions: loyaltyTx.data || [],
    signatures: signatures.data || [],
    commission_rules: commissionRules.data || [],
    commissions: commissions.data || [],
    clock_records: clockRecords.data || [],
    suppliers: suppliers.data || [],
    purchase_orders: purchaseOrders.data || [],
    po_items: poItems.data || [],
    stock_alert_rules: stockAlertRules.data || [],
    checklist_templates: checklistTemplates.data || [],
    receipt_templates: receiptTemplates.data || [],
  };
}
