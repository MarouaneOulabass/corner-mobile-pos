# Corner Mobile ERP

Multi-tenant SaaS ERP for smartphone repair, resale, and accessories businesses. Built with Next.js 14, Supabase, and Claude AI. Features a complete POS, inventory with IMEI tracking, repair management, CGNC-compliant accounting, purchasing, HR, CRM, and 15 domain modules -- all mobile-first with offline support and RTL-ready i18n.

## Quick Start

```bash
# Clone and install
git clone https://github.com/MarouaneOulabass/corner-mobile-pos.git
cd corner-mobile-pos
npm install

# Configure environment
cp .env.example .env.local
# Fill in your Supabase and Anthropic API keys (see Environment Variables below)

# Apply database migrations
# Run each file in order via Supabase Dashboard > SQL Editor:
#   supabase/migrations/001_initial_schema.sql through 010_accounting.sql

# Seed initial data
curl -X POST http://localhost:3000/api/auth/setup

# Start development server
npm run dev
# Open http://localhost:3000
```

### Default Users (created by setup endpoint)

| Email | Role | Password |
|-------|------|----------|
| admin@cornermobile.ma | superadmin | corner2024 |
| manager.m1@cornermobile.ma | manager (M1) | corner2024 |
| manager.m2@cornermobile.ma | manager (M2) | corner2024 |
| seller.m1@cornermobile.ma | seller (M1) | corner2024 |
| seller.m2@cornermobile.ma | seller (M2) | corner2024 |

---

## Project Structure

```
corner-mobile-pos/
  src/
    modules/          # 15 domain modules (business logic)
    app/              # Next.js pages (49) and API routes (85)
    shared/ui/        # Reusable UI primitives
    components/       # Layout + feature components
    contexts/         # React contexts (Auth, I18n)
    lib/              # Legacy services (re-exported from modules)
    locales/          # i18n translations (fr, en, ar)
    types/            # TypeScript interfaces
  supabase/
    migrations/       # 10 SQL migrations (001-010)
  tests/              # Vitest unit tests
  e2e/                # Playwright E2E specs
  public/             # PWA manifest, service worker, icons
```

### Modules

| Module | Description |
|--------|-------------|
| `core` | Auth, sessions, 2FA, event bus, logging, audit, rate limiting |
| `pos` | Point of sale, cart, payments, receipts, offline queue, printers |
| `inventory` | Products, IMEI validation, CSV import, stock alerts, bulk actions |
| `repairs` | Repair tickets, status machine, parts tracking, AI diagnosis |
| `accounting` | CGNC journals, invoices, TVA, fiscal periods, exports |
| `purchasing` | Purchase orders, supplier management, goods receiving |
| `finance` | Cash sessions, gift cards, installment plans |
| `hr` | Clock in/out, attendance, commissions |
| `crm` | Customer profiles, loyalty program |
| `marketing` | WhatsApp messaging, campaigns |
| `bi` | Reports, dashboards, analytics |
| `ai-agents` | Claude API integration (7 AI features) |
| `platform` | Multi-tenant organizations, onboarding |
| `compliance` | Audit trail, data retention |

---

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npm run test` | Run Vitest unit tests (121 tests) |
| `npx playwright test` | Run Playwright E2E tests (10 specs) |

---

## Database Migrations

Migrations are in `supabase/migrations/` and must be applied in order via the Supabase SQL Editor or CLI:

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Core tables (stores, users, products, sales, repairs, etc.) |
| `002_seed_data.sql` | Seed stores and initial data |
| `003_hardening.sql` | Constraints, audit log, price validation |
| `004_data_journal.sql` | Append-only operation journal |
| `005_new_features.sql` | 23 new tables (suppliers, returns, cash, POs, loyalty, etc.) |
| `006_rls_policies.sql` | Initial RLS policies |
| `007_rls_complete.sql` | Sessions, 2FA, complete RLS coverage |
| `008_multi_tenant.sql` | Organizations table, org_id on all tables, RLS rewrite |
| `009_event_bus.sql` | events_log table for event bus |
| `010_accounting.sql` | CGNC accounting (10 tables: chart, journals, invoices, TVA) |

---

## Module Development Guide

To add a new module:

1. **Create the module directory**:
   ```
   src/modules/<module-name>/
     services/       # Server-side business logic
     components/     # React UI components (optional)
     hooks/          # React hooks (optional)
     routes/         # API route helpers (optional)
     schemas/        # Zod validation schemas (optional)
   ```

2. **Add database tables** (if needed):
   - Create a new migration file: `supabase/migrations/011_<name>.sql`
   - Include `organization_id UUID NOT NULL REFERENCES organizations(id)` on every table
   - Add RLS policies for the new tables
   - Make the migration idempotent (`CREATE TABLE IF NOT EXISTS`, `DO $$ ... $$`)

3. **Add API routes**:
   - Create route files under `src/app/api/<domain>/route.ts`
   - Use `verifyAuth()` from `src/lib/auth.ts` for authentication
   - Always filter by `organization_id` and `store_id` from the JWT

4. **Add pages** (if needed):
   - Create page files under `src/app/<path>/page.tsx`
   - Use `'use client'` directive
   - Use `useAuth()` from `src/contexts/AuthContext.tsx`
   - Add route to `src/middleware.ts` public paths if needed

5. **Publish events** (if the module produces events):
   - Import `publishEvent` from `src/modules/core/services/events.ts`
   - Add new event types to the `EventType` union
   - Register handlers in `src/modules/core/services/event-handlers-registry.ts`

6. **Write tests**:
   - Unit tests in `tests/<module>.test.ts` (Vitest)
   - E2E tests in `e2e/<NN>-<name>.spec.ts` (Playwright)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase public (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic Claude API key (for AI features) |
| `NEXTAUTH_SECRET` | Yes | JWT signing secret (min 32 characters, no fallback) |
| `NEXT_PUBLIC_APP_URL` | Yes | Application URL (e.g., http://localhost:3000) |
| `ALLOW_SETUP` | No | Set to `true` to enable `/api/auth/setup` (initial setup only) |
| `SENTRY_DSN` | No | Sentry DSN for error tracking |

---

## Contributing

### Commit Conventions

Follow the existing commit message pattern:
```
feat: description           # New feature
fix: description            # Bug fix
refactor: description       # Code restructuring
test: description           # Test additions/changes
chore: description          # Build, CI, deps
security: description       # Security improvements
```

### PR Process

1. Create a feature branch from `main`
2. Make changes following the module structure
3. Ensure all tests pass (`npm run test && npm run build`)
4. Submit PR with description of changes
5. All PRs require passing CI (lint + test + build)

### Code Conventions

- TypeScript strict mode
- English for all code, comments, and variable names
- French for user-facing UI text (via i18n locales)
- All API routes must verify auth and filter by organization_id
- All new tables must have RLS policies
- Business logic belongs in `src/modules/*/services/`, not in API routes or components

---

## Deployment

### Vercel

1. Connect the GitHub repo to Vercel
2. Add all required environment variables
3. Deploy -- `vercel.json` is pre-configured

### CI (GitHub Actions)

The `.github/workflows/ci.yml` pipeline runs on every push:
- Install dependencies
- Lint (ESLint)
- Unit tests (Vitest)
- Build (Next.js production build)

---

## License

Proprietary -- Corner Mobile. All rights reserved.
