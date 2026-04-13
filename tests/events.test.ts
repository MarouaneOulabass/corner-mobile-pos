import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track insert calls
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/modules/core/services/supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      insert: mockInsert,
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          lt: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ data: [], error: null })),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ data: null, error: null })),
      })),
    })),
  })),
}));

import { publishEvent } from '@/modules/core/services/events';
import { registerHandler, getRegistry } from '@/modules/core/services/event-handlers';
import type { EventHandler } from '@/modules/core/services/event-handlers';

beforeEach(() => {
  vi.clearAllMocks();
  // Clear the handler registry between tests by getting registry and clearing it
  const registry = getRegistry() as Map<string, EventHandler[]>;
  registry.clear();
});

describe('publishEvent', () => {
  it('inserts into events_log via supabase', async () => {
    await publishEvent(
      'sale.completed',
      { sale_id: 'sale-1', total: 3200 },
      'pos',
      'org-1'
    );

    expect(mockInsert).toHaveBeenCalledWith({
      organization_id: 'org-1',
      event_type: 'sale.completed',
      payload: { sale_id: 'sale-1', total: 3200 },
      source_module: 'pos',
      status: 'pending',
    });
  });

  it('logs error if insert fails', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'DB error' } });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await publishEvent('repair.created', {}, 'repairs', 'org-1');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to publish'),
      expect.any(String)
    );
    consoleSpy.mockRestore();
  });
});

describe('registerHandler', () => {
  it('adds handler for event type', () => {
    const handler: EventHandler = vi.fn(async () => {});
    registerHandler('sale.completed', handler);

    const registry = getRegistry();
    const handlers = registry.get('sale.completed');
    expect(handlers).toHaveLength(1);
    expect(handlers![0]).toBe(handler);
  });

  it('supports multiple handlers for the same event type', () => {
    const handler1: EventHandler = vi.fn(async () => {});
    const handler2: EventHandler = vi.fn(async () => {});

    registerHandler('repair.status_changed', handler1);
    registerHandler('repair.status_changed', handler2);

    const registry = getRegistry();
    const handlers = registry.get('repair.status_changed');
    expect(handlers).toHaveLength(2);
  });

  it('multiple handlers are both callable', async () => {
    const handler1 = vi.fn(async () => {});
    const handler2 = vi.fn(async () => {});

    registerHandler('product.created', handler1);
    registerHandler('product.created', handler2);

    const registry = getRegistry();
    const handlers = registry.get('product.created')!;

    const fakeEvent = {
      id: 'evt-1',
      event_type: 'product.created' as const,
      payload: { product_id: 'p-1' },
      organization_id: 'org-1',
    };

    await Promise.all(handlers.map((h) => h(fakeEvent)));

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });
});
