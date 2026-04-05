# CLAUDE.md — Corner Mobile POS

## Project Overview

**Corner Mobile POS** — Application mobile-first de gestion de point de vente pour Corner Mobile, réseau de magasins de réparation et revente de smartphones à Rabat, Maroc.

**Production** : https://corner-mobile-pos.vercel.app
**Repo** : https://github.com/MarouaneOulabass/corner-mobile-pos

---

## Stack technique

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS, mobile-first |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL) |
| Auth | JWT custom (bcrypt + jose), RBAC 3 rôles |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| Scanner | @zxing/browser (camera IMEI barcode scan) |
| Charts | Recharts |
| Labels | bwip-js (Code128 barcodes), window.print() |
| Tests | Vitest (unit), curl (E2E) |
| Deploy | Vercel |

---

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Dashboard (auto-refresh 30s)
│   ├── pos/page.tsx          # Point de vente (dark theme, fullscreen)
│   ├── stock/page.tsx        # Inventaire (list/grid, filters, CSV import, bulk labels, transfers)
│   ├── stock/add/page.tsx    # Ajout produit (IMEI scanner, AI price suggestion)
│   ├── repairs/page.tsx      # Liste réparations (status tabs)
│   ├── repairs/new/page.tsx  # Nouveau ticket réparation
│   ├── repairs/[id]/page.tsx # Détail réparation (status workflow, AI diagnosis)
│   ├── customers/page.tsx    # CRM clients (AI summaries)
│   ├── reports/page.tsx      # Rapports & analytics (charts, AI insights)
│   ├── sales/page.tsx        # Historique ventes (reprint, WhatsApp share)
│   ├── track/page.tsx        # Suivi réparation PUBLIC (sans login)
│   ├── menu/page.tsx         # Menu navigation
│   ├── login/page.tsx        # Connexion
│   └── api/
│       ├── auth/             # login, logout, me, setup
│       ├── products/         # CRUD + bulk import
│       ├── sales/            # CRUD (atomic, anti-double-vente)
│       ├── repairs/          # CRUD + track (public)
│       ├── customers/        # CRUD
│       ├── transfers/        # inter-store
│       ├── notifications/    # bell icon
│       ├── labels/           # print log
│       ├── ai/               # all AI features
│       └── backup/           # journal export + full snapshot
├── lib/
│   ├── supabase.ts           # Client + service client
│   ├── auth.ts               # bcrypt, JWT, RBAC
│   ├── utils.ts              # formatPrice, validateIMEI, status labels
│   ├── ai.ts                 # Claude API wrapper (6 features)
│   └── backup.ts             # Double-write data journal
├── components/
│   ├── layouts/              # Header, BottomNav, DashboardShell
│   └── features/             # IMEIScanner, LabelTemplate, NotificationBell
├── contexts/
│   └── AuthContext.tsx        # React auth context
└── types/
    └── index.ts               # All TypeScript types
```

---

## Database Schema (14 tables)

| Table | Description |
|-------|------------|
| `stores` | 2 magasins (M1 Aït Baha, M2 Oued Dahab) |
| `users` | Utilisateurs avec rôles (superadmin/manager/seller) |
| `products` | Stock par article (IMEI unique pour phones) |
| `customers` | Clients (téléphone = identifiant primaire) |
| `sales` | Ventes avec total, remise, paiement |
| `sale_items` | Articles par vente (prix original + final) |
| `repairs` | Tickets réparation (7 statuts validés) |
| `repair_status_log` | Historique changements de statut |
| `transfers` | Transferts inter-magasins |
| `notifications` | Notifications in-app |
| `ai_logs` | Log de tous les appels IA |
| `labels_log` | Log d'impression étiquettes |
| `product_audit_log` | Audit trail modifications produit |
| `data_journal` | Double saisie — journal append-only de toutes les opérations |

### DB Constraints (migration 003)
- Prix ≥ 0, quantités ≥ 1, coûts ≥ 0
- `users.store_id` NOT NULL

---

## Security

| Feature | Implementation |
|---------|---------------|
| Passwords | bcrypt (12 rounds), migration auto SHA-256→bcrypt |
| JWT | jose HS256, 8h expiry, no fallback secret |
| RBAC | 3 rôles hiérarchiques, vérifié par middleware |
| Rate limiting | Login: 5 tentatives/min par IP |
| Store scoping | Tous les endpoints filtrent par magasin |
| Product PATCH | Champs restreints par rôle |
| Search sanitization | Regex whitelist sur tous les endpoints |
| Setup endpoint | Bloqué en prod, one-time only |
| Password leak | `users(*)` → `users(id,name,role,email)` partout |
| Double-vente | Atomic lock: `UPDATE WHERE status='in_stock'` + rollback |
| Discount cap | Remise ne peut pas dépasser le sous-total |

---

## Data Journal (Double Saisie)

Chaque opération critique est écrite en double dans `data_journal` :
- `product_created`, `product_updated`, `product_deleted`
- `sale_created`
- `repair_created`, `repair_status_changed`
- `transfer_created`
- `customer_created`, `customer_updated`
- `stock_imported`

**Backup API** : `GET /api/backup?type=snapshot` (superadmin) — exporte toute la BDD en JSON.
**Journal API** : `GET /api/backup?type=journal` — exporte les événements.

Le journal est append-only, jamais supprimé.

---

## AI Features (6)

| Feature | Trigger | Model |
|---------|---------|-------|
| Suggestion de prix | Ajout produit | claude-sonnet-4-20250514 |
| Résumé client | Profil client | claude-sonnet-4-20250514 |
| Insights ventes | Rapports | claude-sonnet-4-20250514 |
| Requête NL stock | Recherche | claude-sonnet-4-20250514 |
| Diagnostic réparation | Détail réparation | claude-sonnet-4-20250514 |
| Normalisation CSV | Import stock | claude-sonnet-4-20250514 |

---

## Users & Roles

| Role | Permissions |
|------|-------------|
| `superadmin` | Tout, tous magasins |
| `manager` | Son magasin : ventes, stock, réparations, rapports, transferts, suppression |
| `seller` | Son magasin : ventes, stock (lecture + notes), réparations, clients |

---

## Key Business Rules

1. **IMEI** : Luhn validation, unique across all stores, phone must have quantity=1
2. **Ventes** : Atomic lock prevents double-sale, discount ≤ subtotal, server-side price verification
3. **Réparations** : State machine validé (received→diagnosing→in_repair→ready→delivered)
4. **Transferts** : Produit reste in_stock à destination, auto-detect from_store
5. **Offline POS** : Queue localStorage, sync auto au retour en ligne
6. **Prix** : Toujours négociables au POS (original_price tracké)

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
NEXTAUTH_SECRET=              # Min 32 chars, no fallback
NEXT_PUBLIC_APP_URL=
ALLOW_SETUP=                  # Set to 'true' only for initial setup
```

---

## Supabase Connection

- **Host** : aws-0-eu-west-1.pooler.supabase.com:6543
- **Database** : postgres
- **User** : postgres.yjdbsueukounolkcnnua
- **Migrations** : `supabase/migrations/001-004`

---

## Development

```bash
npm install
npm run dev           # http://localhost:3000
npm run test          # Vitest (16 tests)
npm run build         # Production build
```

---

## Market Position vs Competitors

### Avantages Corner Mobile
- IA intégrée (6 features) — aucun concurrent n'a ça
- Offline POS avec sync — rare même chez les leaders
- IMEI scanner caméra + Luhn validation
- Multi-magasin avec transferts
- Suivi réparation public sans login
- Double saisie / data journal pour recovery

### Gaps identifiés vs Loyverse/Square/RepairDesk
- Pas d'intégration paiement (TPE, mobile money)
- Pas d'app native iOS/Android (PWA uniquement)
- Pas de module comptable / TVA Maroc
- Pas de programme fidélité
- Pas de gestion fournisseurs / bons de commande
- Pas de gestion garantie / SAV
- Pas de support arabe/darija
- Pas de gestion des pièces détachées distincte des produits
