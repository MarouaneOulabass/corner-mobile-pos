import { createServiceClient } from './supabase';
import type { EventType, EventRecord } from './events';

const MAX_RETRIES = 3;
const BATCH_SIZE = 50;

export type EventHandler = (event: Pick<EventRecord, 'id' | 'event_type' | 'payload' | 'organization_id'>) => Promise<void>;

const registry = new Map<EventType, EventHandler[]>();

/**
 * Register a handler for a given event type.
 * Multiple handlers can be registered for the same event type.
 */
export function registerHandler(eventType: EventType, handler: EventHandler): void {
  const existing = registry.get(eventType) || [];
  existing.push(handler);
  registry.set(eventType, existing);
}

/**
 * Process pending events from the events_log table.
 * Fetches up to BATCH_SIZE pending events, runs all registered handlers,
 * and marks each event as 'processed' or 'failed'.
 *
 * Returns the number of events processed.
 */
export async function processEvents(): Promise<number> {
  const supabase = createServiceClient();

  // Fetch pending events (including those that failed but haven't exceeded max retries)
  const { data: events, error: fetchError } = await supabase
    .from('events_log')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lt('retry_count', MAX_RETRIES)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error('[EventBus] Failed to fetch pending events:', fetchError.message);
    return 0;
  }

  if (!events || events.length === 0) {
    return 0;
  }

  let processedCount = 0;

  for (const event of events as EventRecord[]) {
    const handlers = registry.get(event.event_type as EventType) || [];

    if (handlers.length === 0) {
      // No handlers registered — mark as processed (nothing to do)
      await supabase
        .from('events_log')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', event.id);
      processedCount++;
      continue;
    }

    try {
      // Run all handlers for this event
      await Promise.all(
        handlers.map((handler) =>
          handler({
            id: event.id,
            event_type: event.event_type,
            payload: event.payload,
            organization_id: event.organization_id,
          })
        )
      );

      // All handlers succeeded — mark as processed
      await supabase
        .from('events_log')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', event.id);
      processedCount++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const newRetryCount = (event.retry_count || 0) + 1;

      await supabase
        .from('events_log')
        .update({
          status: newRetryCount >= MAX_RETRIES ? 'failed' : 'pending',
          retry_count: newRetryCount,
          error: errorMessage,
        })
        .eq('id', event.id);

      console.error(
        `[EventBus] Handler failed for event ${event.id} (${event.event_type}), retry ${newRetryCount}/${MAX_RETRIES}:`,
        errorMessage
      );
    }
  }

  return processedCount;
}

/**
 * Get the current handler registry (for testing/debugging).
 */
export function getRegistry(): ReadonlyMap<EventType, EventHandler[]> {
  return registry;
}
