import { createServiceClient } from './supabase';

export type EventType =
  | 'sale.completed'
  | 'sale.returned'
  | 'repair.created'
  | 'repair.status_changed'
  | 'repair.completed'
  | 'product.created'
  | 'product.updated'
  | 'product.low_stock'
  | 'transfer.created'
  | 'transfer.received'
  | 'customer.created'
  | 'customer.updated'
  | 'payment.received'
  | 'cash_session.opened'
  | 'cash_session.closed'
  | 'po.created'
  | 'po.received';

export interface EventRecord {
  id: string;
  organization_id: string;
  event_type: EventType;
  payload: Record<string, unknown>;
  source_module: string;
  created_at: string;
  processed_at: string | null;
  status: 'pending' | 'processed' | 'failed';
  retry_count: number;
  error: string | null;
}

export async function publishEvent(
  eventType: EventType,
  payload: Record<string, unknown>,
  sourceModule: string,
  orgId: string
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('events_log').insert({
    organization_id: orgId,
    event_type: eventType,
    payload,
    source_module: sourceModule,
    status: 'pending',
  });

  if (error) {
    console.error(`[EventBus] Failed to publish ${eventType}:`, error.message);
  }
}
