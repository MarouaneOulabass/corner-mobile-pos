# DECISIONS.md — Corner Mobile ERP

Technical decisions log. One line per decision with date.

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-13 | Use pino over winston for structured logging | Lighter, faster, better Next.js edge compat |
| 2026-04-13 | Keep Supabase as DB — no separate Redis yet | Upstash credentials not provided; use pg advisory locks for rate limiting |
| 2026-04-13 | ERP_MASTER_SPEC.md not found — working from inline brief | Brief contains full spec |
| 2026-04-13 | Organization #1 slug: corner-mobile, ICE/IF placeholder until user provides | Noted in QUESTIONS.md |
| 2026-04-13 | shadcn/ui via manual component copy (not CLI) | Avoid heavy CLI dependency, keep control |
| 2026-04-13 | 2FA via otpauth library (lightweight TOTP) | No heavy deps, standard RFC 6238 |
| 2026-04-13 | Idempotency via UNIQUE constraint + ON CONFLICT | Simpler than distributed lock, Postgres-native |
| 2026-04-13 | Event bus via Postgres table + NOTIFY, not external queue | Keep infra simple, Supabase-native |
| 2026-04-13 | Accounting: CGNC standard chart pre-loaded for Morocco | Legal requirement for Moroccan businesses |
| 2026-04-13 | Invoice numbering: Postgres SEQUENCE per org for gap-free | DGI requires sequential, gap-free invoice numbers |
| 2026-04-13 | Module structure: thin route files in app/, logic in src/modules/ | Clean separation, testable services |
| 2026-04-13 | Rate limiting via in-memory Map + cleanup interval (no Redis) | Acceptable for single-instance Vercel; upgrade to Upstash when provided |
