# CLAUDE.md -- Corner Mobile ERP

## Project Overview

**Corner Mobile ERP** -- Multi-tenant SaaS ERP for smartphone repair, resale, and accessories businesses. Originally a POS app for Corner Mobile (Rabat, Morocco), transformed into a full ERP with accounting, purchasing, HR, CRM, marketing, compliance, and BI modules.

**Production**: https://corner-mobile-pos.vercel.app
**Repo**: https://github.com/MarouaneOulabass/corner-mobile-pos

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| UI Components | shadcn/ui (shared), Tailwind CSS (mobile-first, RTL-ready) |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL), 52 tables, RLS on all tables |
| Auth | JWT custom (bcrypt + jose), RBAC 3 roles, 2FA (otpauth), revocable sessions |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) via modular ai-agents service |
| Scanner | @zxing/browser (camera IMEI barcode scan) |
| Charts | Recharts |
| Labels | bwip-js (Code128 barcodes), window.print(), Brother QL-820NWBc support |
| Logging | pino (structured JSON logging with request-id) |
| Error Tracking | Sentry (ready, DSN placeholder) |
| Tests | Vitest (121 unit tests), Playwright (10 E2E test stubs) |
| CI | GitHub Actions (lint + test + build), Husky pre-commit hooks |
| Deploy | Vercel (serverless) |
| PWA | Service worker (public/sw.js), offline POS queue |

---

## Architecture

Modular monorepo with 15 domain modules under `src/modules/`:

```
src/
├── modules/                    # Domain modules (business logic)
│   ├── core/                   # Auth, supabase, events, logging, sessions, 2FA, audit
│   ├── pos/                    # POS UI components, cart, payment, receipts, offline queue
│   ├── inventory/              # Product list, IMEI check, CSV import, bulk actions
│   ├── repairs/                # Repair detail, status machine, parts, checklists
│   ├── accounting/             # CGNC journals, invoices, TVA, exports, fiscal periods
│   ├── purchasing/             # Purchase orders, supplier management
│   ├── finance/                # Cash sessions, installments, gift cards
│   ├── hr/                     # Clock records, commissions, attendance
│   ├── crm/                    # Customer management, loyalty
│   ├── marketing/              # WhatsApp, campaigns
│   ├── bi/                     # Reports, dashboards, analytics
│   ├── ai-agents/              # Claude API wrapper, all AI features
│   ├── platform/               # Multi-tenant, organizations, onboarding
│   ├── compliance/             # Audit trail, data retention, GDPR
│   └── [each module has:]
│       ├── components/         # React UI components
│       ├── hooks/              # React hooks
│       ├── services/           # Business logic (server-side)
│       ├── routes/             # API route helpers
│       └── schemas/            # Zod/validation schemas
├── app/                        # Next.js App Router (49 pages, 85 API routes)
│   ├── page.tsx                # Dashboard (auto-refresh 30s)
│   ├── pos/page.tsx            # POS (dark theme, fullscreen)
│   ├── stock/                  # Inventory pages
│   ├── repairs/                # Repair pages
│   ├── accounting/             # 9 accounting pages (journals, ledger, balance, invoices, etc.)
│   ├── sales/page.tsx          # Sales history
│   ├── customers/page.tsx      # CRM
│   ├── reports/page.tsx        # Analytics + AI insights
│   ├── employees/              # Clock, attendance, commissions
│   ├── purchase-orders/        # PO lifecycle
│   ├── suppliers/              # Supplier management
│   ├── cash/                   # Cash session management
│   ├── returns/                # Product returns
│   ├── trade-ins/              # Device trade-in
│   ├── loyalty/                # Loyalty program
│   ├── gift-cards/             # Gift card management
│   ├── installments/           # Payment plans
│   ├── parts/                  # Spare parts inventory
│   ├── portal/                 # Customer self-service portal
│   ├── track/page.tsx          # Public repair tracking (no login)
│   ├── verify/[id]/page.tsx    # Digital receipt verification
│   └── api/                    # 85 API route files
├── shared/ui/                  # Reusable UI primitives (Button, Dialog, DataTable, etc.)
├── components/
│   ├── layouts/                # Header, BottomNav, DashboardShell
│   └── features/               # IMEIScanner, AIAssistant, GlobalSearch, NotificationBell
├── contexts/
│   ├── AuthContext.tsx          # Auth state + organization + active store
│   └── I18nContext.tsx          # i18n (fr, en, ar)
├── lib/                        # Legacy service files (re-exported from modules)
├── locales/                    # Translation files (fr.json, en.json, ar.json)
└── types/
    └── index.ts                # All TypeScript interfaces
```

---

## Database (52 tables, 10 migrations)

### Core (migrations 001-004)

| Table | Module |
|-------|--------|
| `organizations` | platform |
| `stores` | core |
| `users` | core |
| `sessions` | core |
| `user_2fa` | core |
| `audit_log` | core |
| `product_audit_log` | core |
| `data_journal` | core |
| `notifications` | core |
| `ai_logs` | ai-agents |
| `labels_log` | inventory |
| `events_log` | core (event bus) |

### Commerce (migrations 001, 005)

| Table | Module |
|-------|--------|
| `products` | inventory |
| `customers` | crm |
| `sales` | pos |
| `sale_items` | pos |
| `repairs` | repairs |
| `repair_status_log` | repairs |
| `repair_parts_used` | repairs |
| `transfers` | inventory |
| `returns` | pos |
| `return_items` | pos |
| `trade_ins` | pos |

### Finance (migration 005)

| Table | Module |
|-------|--------|
| `cash_sessions` | finance |
| `cash_movements` | finance |
| `installment_plans` | finance |
| `installment_payments` | finance |
| `gift_cards` | finance |
| `gift_card_transactions` | finance |
| `loyalty_settings` | crm |
| `loyalty_transactions` | crm |

### Purchasing & Inventory (migration 005)

| Table | Module |
|-------|--------|
| `suppliers` | purchasing |
| `purchase_orders` | purchasing |
| `po_items` | purchasing |
| `parts_inventory` | repairs |
| `stock_alert_rules` | inventory |

### HR (migration 005)

| Table | Module |
|-------|--------|
| `commission_rules` | hr |
| `commissions` | hr |
| `clock_records` | hr |

### Operations (migration 005)

| Table | Module |
|-------|--------|
| `signatures` | compliance |
| `checklist_templates` | repairs |
| `receipt_templates` | pos |

### Accounting (migration 010, CGNC-compliant)

| Table | Module |
|-------|--------|
| `chart_of_accounts` | accounting |
| `journals` | accounting |
| `journal_entries` | accounting |
| `journal_lines` | accounting |
| `tax_rates` | accounting |
| `tax_declarations` | accounting |
| `invoices` | accounting |
| `invoice_items` | accounting |
| `credit_notes` | accounting |
| `fiscal_periods` | accounting |

### Multi-Tenant & RLS

- Every table has `organization_id` (FK to `organizations`)
- RLS policies enforce org-level isolation on all 52 tables
- `users.organization_id` set via JWT claim, verified in middleware
- Migration 008 adds organization_id to all existing tables with backfill

---

## Security

| Feature | Implementation |
|---------|---------------|
| Passwords | bcrypt (12 rounds), auto-migration from SHA-256 |
| JWT | jose HS256, 8h expiry, includes org_id + store_id + role |
| RBAC | 3 roles (superadmin, manager, seller), middleware-enforced |
| 2FA | TOTP via otpauth, QR setup, per-user enable/disable |
| Sessions | Revocable sessions table, list/revoke via API |
| RLS | PostgreSQL Row-Level Security on all 52 tables |
| Rate limiting | In-memory (Redis-ready), login: 5 attempts/min/IP |
| Multi-tenant | organization_id on every row, enforced by RLS + middleware |
| Store scoping | All endpoints filter by user's assigned store |
| Audit trail | audit_log + product_audit_log + data_journal (append-only) |
| Input sanitization | Regex whitelist on all search endpoints |
| Double-sale prevention | Atomic lock: `UPDATE WHERE status='in_stock'` + rollback |
| Discount cap | Discount cannot exceed subtotal (server-enforced) |
| Health check | `/api/health` -- DB connectivity, table counts, response time |

---

## Event Bus

17 event types with async processing (stored in `events_log` table):

```
sale.completed, sale.returned,
repair.created, repair.status_changed, repair.completed,
product.created, product.updated, product.low_stock,
transfer.created, transfer.received,
customer.created, customer.updated,
payment.received,
cash_session.opened, cash_session.closed,
po.created, po.received
```

2 registered handlers:
1. `sale.completed` -- Notify store managers via in-app notification
2. `sale.completed` -- Create accounting journal entry (auto-entries)

Processing: `POST /api/events/process` fetches pending events, runs handlers, retries up to 3 times.

---

## AI Features (7)

| Feature | Trigger | Module |
|---------|---------|--------|
| Price suggestion | Product entry | ai-agents |
| Customer summary | Customer profile | ai-agents |
| Sales insights | Reports page | ai-agents |
| NL stock query | Search bar (Cmd+K) | ai-agents |
| Repair diagnosis | Repair detail | ai-agents |
| CSV normalization | Stock import | ai-agents |
| AI assistant | Floating chat (all pages) | ai-agents |

All AI calls are async, advisory-only, and logged to `ai_logs`.

---

## Users & Roles

| Role | Permissions |
|------|-------------|
| `superadmin` | All modules, all stores, all organizations |
| `manager` | Own store: full access to POS, stock, repairs, reports, transfers, accounting, HR |
| `seller` | Own store: POS, stock (read + notes), repairs (create/update), customers |

---

## Key Business Rules

1. **IMEI**: Luhn validation, unique across all stores, phone quantity must be 1
2. **Sales**: Atomic lock prevents double-sale, discount <= subtotal, server-side price verification
3. **Repairs**: Validated state machine (received -> diagnosing -> waiting_parts -> in_repair -> ready -> delivered)
4. **Transfers**: Product stays in_stock at destination, auto-detect from_store
5. **Offline POS**: localStorage queue, auto-sync on reconnect
6. **Prices**: Always negotiable at POS (original_price tracked for margin analysis)
7. **Accounting**: CGNC chart of accounts, double-entry bookkeeping, auto-entries on sale
8. **Multi-tenant**: organization_id on every record, RLS-enforced isolation

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase public key
SUPABASE_SERVICE_ROLE_KEY=        # Supabase service role key
ANTHROPIC_API_KEY=                # Claude API key
NEXTAUTH_SECRET=                  # JWT secret (min 32 chars, no fallback)
NEXT_PUBLIC_APP_URL=              # App URL (http://localhost:3000)
ALLOW_SETUP=                      # 'true' only for initial setup
SENTRY_DSN=                       # Sentry DSN (optional, error tracking)
```

---

## Development

```bash
npm install
npm run dev             # http://localhost:3000
npm run test            # Vitest (121 unit tests)
npx playwright test     # Playwright E2E (10 specs)
npm run build           # Production build
npm run lint            # ESLint
```

### Migrations

Apply in order via Supabase SQL Editor:
```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_seed_data.sql
supabase/migrations/003_hardening.sql
supabase/migrations/004_data_journal.sql
supabase/migrations/005_new_features.sql
supabase/migrations/006_rls_policies.sql
supabase/migrations/007_rls_complete.sql
supabase/migrations/008_multi_tenant.sql
supabase/migrations/009_event_bus.sql
supabase/migrations/010_accounting.sql
```

---

## Data Journal (Double Saisie)

Critical operations are double-written to `data_journal` (append-only):
- product_created, product_updated, product_deleted
- sale_created, repair_created, repair_status_changed
- transfer_created, customer_created, customer_updated
- stock_imported

**Backup**: `GET /api/backup?type=snapshot` (superadmin) -- full DB export as JSON.
**Journal**: `GET /api/backup?type=journal` -- event journal export.
