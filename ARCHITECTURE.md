# ARCHITECTURE.md -- Corner Mobile ERP

## High-Level System Architecture

```
+------------------------------------------------------------------+
|                         CLIENTS                                   |
|  +------------+  +------------+  +-------------+  +----------+   |
|  | Mobile PWA |  | Tablet PWA |  | Desktop Web |  | Customer |   |
|  | (Android/  |  | (iPad/     |  | (Manager    |  | Portal   |   |
|  |  iOS)      |  |  Android)  |  |  Desktop)   |  | (Public) |   |
|  +------+-----+  +------+-----+  +------+------+  +----+-----+   |
+---------|----------------|----------------|--------------|--------+
          |                |                |              |
          v                v                v              v
+------------------------------------------------------------------+
|                    NEXT.JS APP ROUTER                             |
|  +------------------------------------------------------------+  |
|  |  Middleware (JWT verify, RBAC, org_id inject, rate limit)   |  |
|  +------------------------------------------------------------+  |
|  |                                                              | |
|  |  +------------------+  +------------------+                  | |
|  |  | 49 Pages (SSR)   |  | 85 API Routes    |                 | |
|  |  | /pos, /stock,    |  | /api/sales,      |                 | |
|  |  | /repairs,        |  | /api/products,   |                 | |
|  |  | /accounting, ... |  | /api/accounting, |                 | |
|  |  +--------+---------+  | /api/events, ... |                 | |
|  |           |             +--------+---------+                 | |
|  +-----------|-----------------------|--------------------------+ |
|              |                       |                            |
|              v                       v                            |
|  +------------------------------------------------------------+  |
|  |              MODULE SERVICES LAYER                          |  |
|  |                                                              | |
|  |  core/     pos/      inventory/  repairs/    accounting/    | |
|  |  auth      cart      products    status      journals       | |
|  |  events    payment   IMEI        parts       invoices       | |
|  |  sessions  receipts  CSV import  checklists  TVA/CGNC      | |
|  |  2FA       offline   bulk ops    AI diag     auto-entries   | |
|  |  audit     printer   alerts      timeline    fiscal periods | |
|  |  logger    ...       ...         ...         exports        | |
|  |                                                              | |
|  |  purchasing/  finance/    hr/        crm/      marketing/   | |
|  |  POs          cash        clock      customers  WhatsApp    | |
|  |  suppliers    gift cards  commission loyalty    campaigns    | |
|  |  receiving    installment attendance ...        ...          | |
|  |                                                              | |
|  |  ai-agents/   platform/   bi/        compliance/            | |
|  |  Claude API   orgs        reports    audit trail             | |
|  |  NL search    onboarding  dashboard  data retention          | |
|  |  ...          ...         ...        ...                     | |
|  +------------------------------------------------------------+  |
|              |                       |                            |
|              v                       v                            |
|  +------------------------------------------------------------+  |
|  |              EVENT BUS (events_log table)                   |  |
|  |  publish() --> events_log --> processEvents() --> handlers  |  |
|  |  17 event types | batch processing | 3 retries             |  |
|  +------------------------------------------------------------+  |
|              |                                                    |
|              v                                                    |
+------------------------------------------------------------------+
|                    SUPABASE (PostgreSQL)                          |
|  +------------------------------------------------------------+  |
|  |  52 tables | RLS on all | organization_id isolation         |  |
|  |  10 migrations (001-010) | CGNC chart of accounts          |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
          |                                |
          v                                v
+------------------+            +-------------------+
| Anthropic Claude |            | External Services |
| (AI features)    |            | - Sentry (errors) |
| claude-sonnet    |            | - WhatsApp API    |
+------------------+            +-------------------+
```

---

## Monorepo Module Structure

Each module under `src/modules/` follows a consistent internal structure:

```
src/modules/<module>/
  components/    # React components (client-side)
  hooks/         # React hooks (client-side state + effects)
  services/      # Business logic (server-side, imported by API routes)
  routes/        # API route helpers (request parsing, response formatting)
  schemas/       # Validation schemas (Zod)
```

### Module Responsibilities

| Module | Responsibility | Key Services |
|--------|---------------|-------------|
| **core** | Authentication, authorization, event bus, logging, sessions, 2FA, audit, data journal | auth, events, event-handlers, sessions, two-factor, logger, audit, rate-limit |
| **pos** | Point of sale UI, cart management, payment processing, receipts, offline queue, printing | useCart, usePayment, useOfflineQueue, receipt-builder, thermal-printer, brother-printer |
| **inventory** | Product management, IMEI validation, CSV import, stock filtering, bulk operations | useProductList, useProductActions, useCsvImport, imei-check, automation |
| **repairs** | Repair ticket lifecycle, status machine, parts tracking, AI diagnosis, checklists | useRepairDetail, useRepairStatus, useRepairParts |
| **accounting** | CGNC-compliant bookkeeping, journals, invoices, TVA declarations, fiscal period mgmt, exports | journal-service, invoice-service, tax-service, fiscal-service, auto-entries, export-service |
| **purchasing** | Purchase orders, supplier management, goods receiving | PO lifecycle services |
| **finance** | Cash sessions, gift cards, installment plans | Cash, gift card, installment services |
| **hr** | Employee clock in/out, attendance, commissions | Clock, commission services |
| **crm** | Customer profiles, loyalty program | Customer, loyalty services |
| **marketing** | WhatsApp messaging, campaign management | whatsapp service |
| **bi** | Dashboards, reports, analytics | Report services, chart components |
| **ai-agents** | Claude API client, all AI feature implementations | ai-client (price suggestion, NL search, diagnosis, insights, CSV normalization) |
| **platform** | Multi-tenant organizations, onboarding, white-label settings | Org management, tenant provisioning |
| **compliance** | Audit trail, data retention policies, GDPR | Audit services |

---

## Multi-Tenant Design

### Organization Model

```
organizations
  id (UUID, PK)
  name, slug (unique)
  country (default 'MA')
  plan (starter | pro | enterprise)
  billing_status
  ice, if_number, rc, cnss, patente  (Moroccan tax IDs)
  logo_url, primary_color, settings (JSONB)
```

### Isolation Strategy

1. **Every table** has an `organization_id UUID NOT NULL` column (FK to `organizations`)
2. **RLS policies** enforce `organization_id = auth.jwt()->>'organization_id'` on all tables
3. **Middleware** extracts `organization_id` from JWT and injects it into request context
4. **API routes** always filter by `organization_id` from the authenticated user
5. **Stores** belong to an organization; users belong to a store (and thus an organization)

### Data Flow for Multi-Tenant Request

```
Request --> Middleware
  1. Extract JWT from cookie/header
  2. Verify signature (jose HS256)
  3. Extract: user_id, role, store_id, organization_id
  4. Check RBAC for route
  5. Inject org context into request
  --> API Route
    6. Use org_id in all Supabase queries
    7. RLS provides second layer of enforcement
```

---

## Event Bus Architecture

The event bus provides loose coupling between modules via an `events_log` database table.

### Flow

```
Module A                    events_log table              Event Processor
  |                              |                              |
  |-- publishEvent() -------->  INSERT (status='pending')       |
  |                              |                              |
  |                              |  POST /api/events/process    |
  |                              |<-----------------------------+
  |                              |                              |
  |                              |  SELECT pending events       |
  |                              |----------------------------->|
  |                              |                              |
  |                              |  Run registered handlers     |
  |                              |  UPDATE status='processed'   |
  |                              |<-----------------------------+
```

### Event Types (17)

| Category | Events |
|----------|--------|
| Sales | `sale.completed`, `sale.returned` |
| Repairs | `repair.created`, `repair.status_changed`, `repair.completed` |
| Inventory | `product.created`, `product.updated`, `product.low_stock` |
| Transfers | `transfer.created`, `transfer.received` |
| Customers | `customer.created`, `customer.updated` |
| Finance | `payment.received`, `cash_session.opened`, `cash_session.closed` |
| Purchasing | `po.created`, `po.received` |

### Registered Handlers

1. **sale.completed -> Notification**: Notifies store managers when a sale is made
2. **sale.completed -> Accounting**: Auto-creates journal entry (debit cash/bank, credit revenue)

### Reliability

- Events persisted to DB before processing (at-least-once delivery)
- Batch processing (up to 50 events per invocation)
- Retry up to 3 times on failure
- Failed events logged with error message

---

## Security Layers

```
Layer 1: HTTPS (Vercel enforced)
  |
Layer 2: Rate Limiting (5 login attempts/min/IP)
  |
Layer 3: JWT Authentication (jose HS256, 8h expiry)
  |
Layer 4: 2FA Verification (TOTP via otpauth, optional per-user)
  |
Layer 5: Revocable Sessions (sessions table, list/revoke API)
  |
Layer 6: RBAC Middleware (superadmin > manager > seller)
  |
Layer 7: Organization Isolation (organization_id in JWT + queries)
  |
Layer 8: Store Scoping (user sees only their assigned store data)
  |
Layer 9: PostgreSQL RLS (row-level security on all 52 tables)
  |
Layer 10: Input Sanitization (regex whitelist on search, Zod validation)
  |
Layer 11: Audit Trail (audit_log + product_audit_log + data_journal)
```

---

## Data Flow: Sale Lifecycle

How a sale flows from POS through the system:

```
1. SELLER scans IMEI or searches product
   |
2. Product added to CART (useCart hook)
   | - Price editable inline (negotiation)
   | - Discount applied (flat or %)
   |
3. PAYMENT selected (cash/card/virement/mixed)
   | - Customer assigned (optional)
   |
4. POST /api/sales (confirm sale)
   | a. Validate cart items exist and are in_stock
   | b. Atomic lock: UPDATE products SET status='sold' WHERE status='in_stock'
   |    (prevents double-sale)
   | c. INSERT sale + sale_items
   | d. publishEvent('sale.completed', { sale_id, store_id, total, ... })
   | e. Write to data_journal (sale_created)
   | f. Return sale receipt data
   |
5. EVENT BUS processes sale.completed
   | a. Handler 1: Create notification for store manager
   | b. Handler 2: Create accounting journal entry
   |    - Debit: 5141 (Caisse) or 5143 (Banque)
   |    - Credit: 7111 (Ventes de marchandises)
   |
6. RECEIPT displayed on screen
   | - Shareable via WhatsApp (wa.me link)
   | - Printable (thermal printer or Brother QL)
   | - Verifiable at /verify/[id]
   |
7. OFFLINE MODE (if no internet)
   | - Sale queued in localStorage
   | - Auto-synced when connection restored
   | - OfflineBanner component shown in POS
```

---

## Database Schema Overview

### Table Groups by Migration

| Migration | Tables Added | Purpose |
|-----------|-------------|---------|
| 001 | stores, users, products, customers, sales, sale_items, repairs, repair_status_log, transfers, notifications, ai_logs, labels_log | Core schema |
| 002 | (seed data) | Initial stores + users |
| 003 | product_audit_log | Audit trail + constraints |
| 004 | data_journal | Append-only operation journal |
| 005 | suppliers, returns, return_items, trade_ins, parts_inventory, repair_parts_used, cash_sessions, cash_movements, installment_plans, installment_payments, gift_cards, gift_card_transactions, loyalty_settings, loyalty_transactions, signatures, commission_rules, commissions, clock_records, purchase_orders, po_items, stock_alert_rules, checklist_templates, receipt_templates | New features (23 tables) |
| 006 | (policies only) | Initial RLS policies |
| 007 | sessions, user_2fa, audit_log | Security tables + complete RLS |
| 008 | organizations | Multi-tenant + org_id on all tables |
| 009 | events_log | Event bus |
| 010 | chart_of_accounts, journals, journal_entries, journal_lines, tax_rates, tax_declarations, invoices, invoice_items, credit_notes, fiscal_periods | CGNC accounting (10 tables) |

---

## API Route Structure

All API routes are under `src/app/api/`:

| Domain | Routes | Methods |
|--------|--------|---------|
| `/api/auth/*` | login, logout, me, setup, sessions, 2fa/* | POST, GET, DELETE |
| `/api/products/*` | CRUD, bulk import, [id] | GET, POST, PATCH, DELETE |
| `/api/sales/*` | CRUD, [id] | GET, POST |
| `/api/repairs/*` | CRUD, [id], track, [id]/parts, [id]/checklist, [id]/photos | GET, POST, PATCH |
| `/api/customers/*` | CRUD, [id] | GET, POST, PATCH |
| `/api/accounting/*` | accounts, entries, journals, ledger, balance, invoices, vat, exports, fiscal-periods | GET, POST, PATCH |
| `/api/cash/*` | sessions, sessions/[id], movements | GET, POST, PATCH |
| `/api/purchase-orders/*` | CRUD, [id], [id]/receive | GET, POST, PATCH |
| `/api/suppliers/*` | CRUD, [id] | GET, POST, PATCH |
| `/api/transfers` | Create transfer | POST |
| `/api/events/process` | Process pending events | POST |
| `/api/search` | Global Cmd+K search | GET |
| `/api/health` | System health check | GET |
| `/api/backup` | DB snapshot / journal export | GET |
| `/api/ai` | AI features proxy | POST |
| `/api/whatsapp/*` | send, templates | POST, GET |
| + 20 more | returns, trade-ins, gift-cards, loyalty, installments, commissions, clock, parts, labels, notifications, stock-alerts, stores, users, warranty, signatures, checklists, receipt-templates, portal, automation, imei-check | Various |

---

## Frontend Architecture

### Next.js App Router

- All pages under `src/app/` use the App Router (not Pages Router)
- Pages are client components (`'use client'`) for interactivity
- API routes are server-side (Route Handlers)
- Middleware runs on Edge Runtime for JWT verification

### Component Hierarchy

```
layout.tsx (root)
  AuthProvider (context)
    I18nProvider (context)
      ServiceWorkerRegistrar
        DashboardShell
          Header (with GlobalSearch, NotificationBell, AIAssistant)
          [Page Content]
          BottomNav (mobile: Home, POS, Stock, More)
```

### Shared UI Library (`src/shared/ui/`)

Reusable primitives built on shadcn/ui patterns:
- Button, Input, Select, Dialog, ConfirmDialog
- DataTable (sortable, filterable)
- DateRangePicker, PriceInput, CustomerPicker, ProductPicker
- Tabs, Toast

### Key Features

| Feature | Component | Location |
|---------|-----------|----------|
| Global Search | GlobalSearch (Cmd+K) | components/features/ |
| AI Assistant | AIAssistant (floating chat) | components/features/ |
| IMEI Scanner | IMEIScanner (camera) | components/features/ |
| Notifications | NotificationBell | components/features/ |
| Offline Banner | OfflineBanner | modules/pos/components/ |
| Receipt Preview | ReceiptPreview | components/features/ |

### i18n

Three languages with RTL support:
- `fr.json` (French -- default)
- `en.json` (English)
- `ar.json` (Arabic -- RTL layout)

Language switcher in Header component. All 456 translation keys.

### PWA

- `public/manifest.json` -- installable on home screen
- `public/sw.js` -- service worker for offline caching
- Offline POS queue in localStorage
