import { publishEvent } from './events';

// ─── Sales ──────────────────────────────────────────────────────────

export function emitSaleCompleted(
  sale: { id: string; store_id: string; seller_id: string; total: number; items: unknown[] },
  orgId: string
): void {
  publishEvent('sale.completed', sale as unknown as Record<string, unknown>, 'pos', orgId);
}

export function emitSaleReturned(
  sale: { id: string; store_id: string; total: number; reason?: string },
  orgId: string
): void {
  publishEvent('sale.returned', sale as unknown as Record<string, unknown>, 'pos', orgId);
}

// ─── Repairs ────────────────────────────────────────────────────────

export function emitRepairCreated(
  repair: { id: string; store_id: string; customer_id?: string; device: string },
  orgId: string
): void {
  publishEvent('repair.created', repair as unknown as Record<string, unknown>, 'repairs', orgId);
}

export function emitRepairStatusChanged(
  repair: { id: string; store_id: string; old_status: string; new_status: string; changed_by: string },
  orgId: string
): void {
  publishEvent('repair.status_changed', repair as unknown as Record<string, unknown>, 'repairs', orgId);
}

export function emitRepairCompleted(
  repair: { id: string; store_id: string; customer_id?: string; final_cost: number },
  orgId: string
): void {
  publishEvent('repair.completed', repair as unknown as Record<string, unknown>, 'repairs', orgId);
}

// ─── Products ───────────────────────────────────────────────────────

export function emitProductCreated(
  product: { id: string; store_id: string; brand: string; model: string; imei?: string },
  orgId: string
): void {
  publishEvent('product.created', product as unknown as Record<string, unknown>, 'inventory', orgId);
}

export function emitProductUpdated(
  product: { id: string; store_id: string; changes: Record<string, unknown> },
  orgId: string
): void {
  publishEvent('product.updated', product as unknown as Record<string, unknown>, 'inventory', orgId);
}

export function emitProductLowStock(
  product: { product_id: string; store_id: string; brand: string; model: string; current_quantity: number; threshold: number },
  orgId: string
): void {
  publishEvent('product.low_stock', product as unknown as Record<string, unknown>, 'inventory', orgId);
}

// ─── Transfers ──────────────────────────────────────────────────────

export function emitTransferCreated(
  transfer: { id: string; product_id: string; from_store_id: string; to_store_id: string; initiated_by: string },
  orgId: string
): void {
  publishEvent('transfer.created', transfer as unknown as Record<string, unknown>, 'transfers', orgId);
}

export function emitTransferReceived(
  transfer: { id: string; product_id: string; from_store_id: string; to_store_id: string; received_by: string },
  orgId: string
): void {
  publishEvent('transfer.received', transfer as unknown as Record<string, unknown>, 'transfers', orgId);
}

// ─── Customers ──────────────────────────────────────────────────────

export function emitCustomerCreated(
  customer: { id: string; name: string; phone: string; store_id?: string },
  orgId: string
): void {
  publishEvent('customer.created', customer as unknown as Record<string, unknown>, 'crm', orgId);
}

export function emitCustomerUpdated(
  customer: { id: string; changes: Record<string, unknown> },
  orgId: string
): void {
  publishEvent('customer.updated', customer as unknown as Record<string, unknown>, 'crm', orgId);
}

// ─── Payments ───────────────────────────────────────────────────────

export function emitPaymentReceived(
  payment: { id: string; sale_id?: string; repair_id?: string; amount: number; method: string; store_id: string },
  orgId: string
): void {
  publishEvent('payment.received', payment as unknown as Record<string, unknown>, 'pos', orgId);
}

// ─── Cash Sessions ──────────────────────────────────────────────────

export function emitCashSessionOpened(
  session: { id: string; store_id: string; opened_by: string; opening_amount: number },
  orgId: string
): void {
  publishEvent('cash_session.opened', session as unknown as Record<string, unknown>, 'pos', orgId);
}

export function emitCashSessionClosed(
  session: { id: string; store_id: string; closed_by: string; closing_amount: number; expected_amount: number },
  orgId: string
): void {
  publishEvent('cash_session.closed', session as unknown as Record<string, unknown>, 'pos', orgId);
}

// ─── Purchase Orders ────────────────────────────────────────────────

export function emitPOCreated(
  po: { id: string; store_id: string; supplier_id: string; total: number; created_by: string },
  orgId: string
): void {
  publishEvent('po.created', po as unknown as Record<string, unknown>, 'purchasing', orgId);
}

export function emitPOReceived(
  po: { id: string; store_id: string; supplier_id: string; received_by: string; items_count: number },
  orgId: string
): void {
  publishEvent('po.received', po as unknown as Record<string, unknown>, 'purchasing', orgId);
}
