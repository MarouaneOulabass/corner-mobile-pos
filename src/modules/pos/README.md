# Module: pos

## Responsibility

Point of sale interface and sale processing. Provides the full sale flow: product search, cart management, inline price editing, discount application, payment processing, receipt generation, and offline queuing. Designed for sub-30-second sale completion.

## Tables Owned

| Table | Description |
|-------|-------------|
| `sales` | Sale records (total, discount, payment method, seller, customer) |
| `sale_items` | Line items per sale (product, quantity, original_price, final unit_price) |
| `returns` | Product returns and exchanges |
| `return_items` | Line items per return |
| `trade_ins` | Device trade-in records |
| `receipt_templates` | Configurable receipt formats |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/sales` | GET, POST | List sales / create new sale (atomic) |
| `/api/sales/[id]` | GET | Get sale details |
| `/api/returns` | GET, POST | List/create returns |
| `/api/returns/[id]` | PATCH | Update return status |
| `/api/trade-ins` | GET, POST | List/create trade-ins |
| `/api/trade-ins/[id]` | PATCH | Update trade-in |
| `/api/receipt-templates` | GET, POST | Manage receipt templates |

## Events Published

| Event | When | Payload |
|-------|------|---------|
| `sale.completed` | After successful sale | sale_id, store_id, total, seller_id, items |
| `sale.returned` | After return processed | return_id, original_sale_id, refund_amount |

## Events Consumed

None.

## Key Files

| File | Purpose |
|------|---------|
| `components/ProductSearch.tsx` | IMEI scan + text search for adding items to cart |
| `components/CartView.tsx` | Cart list with inline price editing |
| `components/PaymentDialog.tsx` | Payment method selection (cash/card/virement/mixed) |
| `components/ReceiptScreen.tsx` | Post-sale receipt display + WhatsApp share |
| `components/BottomTotals.tsx` | Running total bar at bottom of POS |
| `components/OfflineBanner.tsx` | Offline status indicator |
| `hooks/useCart.ts` | Cart state management (add, remove, edit price, totals) |
| `hooks/usePayment.ts` | Payment processing and sale submission |
| `hooks/useDiscount.ts` | Discount calculation (flat or percentage) |
| `hooks/useOfflineQueue.ts` | localStorage queue for offline sales + auto-sync |
| `hooks/useCustomerSearch.ts` | Customer search/create for sale assignment |
| `services/receipt-builder.ts` | Generate receipt HTML/data |
| `services/thermal-printer.ts` | Thermal printer integration |
| `services/brother-printer.ts` | Brother QL-820NWBc label printer |

## Business Rules

- Prices are never locked -- seller can edit any price inline at POS
- Original price is always tracked alongside final sale price (margin analysis)
- Discount cannot exceed subtotal (server-enforced)
- Atomic double-sale prevention: `UPDATE products SET status='sold' WHERE status='in_stock'`
- Offline sales queued in localStorage and synced automatically on reconnect
