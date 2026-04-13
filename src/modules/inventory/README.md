# Module: inventory

## Responsibility

Product and stock management. Handles IMEI-tracked phone inventory, accessory stock, CSV bulk import with AI normalization, inter-store transfers, stock alerts, and product filtering/search.

## Tables Owned

| Table | Description |
|-------|-------------|
| `products` | All inventory items (phones, accessories, parts) with IMEI, condition, prices |
| `transfers` | Inter-store transfer records |
| `labels_log` | Label print history |
| `stock_alert_rules` | Configurable low-stock thresholds |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/products` | GET, POST | List products (filtered) / add new product |
| `/api/products/[id]` | GET, PATCH, DELETE | Product CRUD |
| `/api/products/bulk` | POST | Bulk CSV import |
| `/api/transfers` | POST | Create inter-store transfer |
| `/api/labels` | POST | Log label print |
| `/api/stock-alerts` | GET, POST | List/create stock alerts |
| `/api/stock-alerts/rules` | GET, POST | Manage alert rules |
| `/api/imei-check` | POST | Validate IMEI (Luhn + blacklist check) |

## Events Published

| Event | When | Payload |
|-------|------|---------|
| `product.created` | New product added | product_id, imei, store_id |
| `product.updated` | Product modified | product_id, changed_fields |
| `product.low_stock` | Stock below threshold | store_id, product_type, count |
| `transfer.created` | Transfer initiated | transfer_id, product_id, from_store, to_store |
| `transfer.received` | Transfer received at destination | transfer_id, product_id |

## Events Consumed

None.

## Key Files

| File | Purpose |
|------|---------|
| `components/ProductList.tsx` | List view of products with status badges |
| `components/ProductGrid.tsx` | Grid view of products (card layout) |
| `components/ProductFilters.tsx` | Filter bar (store, status, brand, condition, price range) |
| `components/ProductDetailSheet.tsx` | Full product detail bottom sheet |
| `components/CsvImportDialog.tsx` | CSV upload dialog with preview + AI normalization |
| `components/BulkActions.tsx` | Multi-select actions (bulk print labels, bulk transfer) |
| `components/StockStats.tsx` | Stock summary statistics |
| `hooks/useProductList.ts` | Product fetching, filtering, pagination |
| `hooks/useProductActions.ts` | Product CRUD operations (create, update, delete, transfer) |
| `hooks/useCsvImport.ts` | CSV parsing, AI normalization, preview, bulk insert |
| `services/imei-check.ts` | IMEI Luhn validation, duplicate check, blacklist lookup |
| `services/automation.ts` | Stock automation rules (alerts, auto-reorder) |

## Business Rules

- IMEI must pass Luhn validation and be unique across all stores
- Phones must have quantity = 1 (IMEI-tracked)
- Accessories can have quantity > 1
- Product status: `in_stock`, `sold`, `in_repair`, `transferred`, `returned`
- Transfers require manager role or above
- CSV import supports Loyverse export format + AI column mapping
