# Module: accounting

## Responsibility

Full CGNC-compliant (Code General de Normalisation Comptable) double-entry bookkeeping for Moroccan businesses. Manages chart of accounts, journals, journal entries, invoicing, TVA declarations, fiscal period management, and financial exports.

## Tables Owned

| Table | Description |
|-------|-------------|
| `chart_of_accounts` | CGNC plan comptable (class 1-7) |
| `journals` | Accounting journals (sales, purchases, cash, bank, OD, payroll) |
| `journal_entries` | Double-entry journal entries (header) |
| `journal_lines` | Debit/credit lines per journal entry |
| `tax_rates` | Moroccan TVA rates (20%, 14%, 10%, 7%, 0%) |
| `tax_declarations` | TVA declaration records |
| `invoices` | Sales invoices |
| `invoice_items` | Invoice line items |
| `credit_notes` | Credit notes (avoir) |
| `fiscal_periods` | Fiscal year/period management (open/closed) |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/accounting/accounts` | GET, POST | Chart of accounts CRUD |
| `/api/accounting/journals` | GET | List journals |
| `/api/accounting/entries` | GET, POST | Journal entries CRUD |
| `/api/accounting/entries/[id]/validate` | POST | Validate (lock) a journal entry |
| `/api/accounting/ledger` | GET | General ledger view |
| `/api/accounting/balance` | GET | Trial balance (balance des comptes) |
| `/api/accounting/invoices` | GET, POST | Invoice CRUD |
| `/api/accounting/invoices/[id]` | GET, PATCH | Invoice detail/update |
| `/api/accounting/vat` | GET, POST | TVA declaration |
| `/api/accounting/exports` | GET | Export (FEC, CSV, balance sheet) |
| `/api/accounting/fiscal-periods` | GET, POST | Fiscal period management |

## Events Published

None directly.

## Events Consumed

| Event | Handler | Action |
|-------|---------|--------|
| `sale.completed` | auto-entries | Create journal entry: debit cash/bank, credit revenue (7111) |

## Key Files

| File | Purpose |
|------|---------|
| `services/journal-service.ts` | Create/list/validate journal entries, double-entry enforcement |
| `services/invoice-service.ts` | Invoice generation, numbering (INV-YYYY-NNNNNN), status tracking |
| `services/tax-service.ts` | TVA calculation, declaration generation |
| `services/fiscal-service.ts` | Fiscal period open/close, year-end closing |
| `services/auto-entries.ts` | Automatic journal entries from events (sale -> accounting) |
| `services/export-service.ts` | FEC export (Fichier des Ecritures Comptables), CSV, balance sheet |

## CGNC Account Classes

| Class | Label | Example Accounts |
|-------|-------|-----------------|
| 1 | Comptes de financement permanent | Capital, reserves |
| 2 | Comptes d'actif immobilise | Equipment, deposits |
| 3 | Comptes d'actif circulant | Stock (3111), clients (3421) |
| 4 | Comptes de passif circulant | Fournisseurs (4411), TVA (4455) |
| 5 | Comptes de tresorerie | Caisse (5141), banque (5143) |
| 6 | Comptes de charges | Achats (6111), salaires (6171) |
| 7 | Comptes de produits | Ventes (7111), other revenue |

## Business Rules

- All journal entries must balance (total debits = total credits)
- Validated entries are locked and cannot be modified
- Fiscal periods can be closed (no new entries allowed in closed periods)
- TVA rates follow Moroccan tax law (20% standard, 14%, 10%, 7%, 0% exempt)
- Invoice numbering is sequential per organization per year
- FEC export follows French/Moroccan tax authority format requirements
