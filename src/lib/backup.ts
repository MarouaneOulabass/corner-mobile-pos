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
  | 'stock_imported';

interface JournalEntry {
  event_type: EventType;
  entity_id: string;
  entity_type: 'product' | 'sale' | 'repair' | 'transfer' | 'customer' | 'user';
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

  const [stores, users, products, customers, sales, saleItems, repairs, repairLogs, transfers] = await Promise.all([
    supabase.from('stores').select('*'),
    supabase.from('users').select('id, email, name, role, store_id, created_at'),
    supabase.from('products').select('*'),
    supabase.from('customers').select('*'),
    supabase.from('sales').select('*'),
    supabase.from('sale_items').select('*'),
    supabase.from('repairs').select('*'),
    supabase.from('repair_status_log').select('*'),
    supabase.from('transfers').select('*'),
  ]);

  return {
    exported_at: new Date().toISOString(),
    version: '1.0',
    stores: stores.data || [],
    users: users.data || [],
    products: products.data || [],
    customers: customers.data || [],
    sales: sales.data || [],
    sale_items: saleItems.data || [],
    repairs: repairs.data || [],
    repair_status_log: repairLogs.data || [],
    transfers: transfers.data || [],
  };
}
