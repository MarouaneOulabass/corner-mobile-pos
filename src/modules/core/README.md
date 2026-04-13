# Module: core

## Responsibility

Foundation module providing authentication, authorization, event bus, structured logging, session management, two-factor authentication, audit trail, rate limiting, and the Supabase client. All other modules depend on core services.

## Tables Owned

| Table | Description |
|-------|-------------|
| `users` | User accounts with roles and store assignment |
| `stores` | Physical store locations |
| `sessions` | Revocable user sessions (JWT + device tracking) |
| `user_2fa` | TOTP 2FA secrets per user |
| `audit_log` | General audit trail (who did what, when) |
| `product_audit_log` | Product-specific change tracking |
| `data_journal` | Append-only operation journal (double-write) |
| `notifications` | In-app notifications |
| `events_log` | Event bus storage (pending/processed/failed) |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/login` | POST | Authenticate user, return JWT |
| `/api/auth/logout` | POST | Invalidate session |
| `/api/auth/me` | GET | Get current user profile |
| `/api/auth/setup` | POST | One-time seed (stores + users) |
| `/api/auth/sessions` | GET, DELETE | List/revoke sessions |
| `/api/auth/2fa/setup` | POST | Generate TOTP secret + QR |
| `/api/auth/2fa/verify` | POST | Verify TOTP code |
| `/api/auth/2fa/validate` | POST | Validate 2FA during login |
| `/api/auth/2fa/disable` | POST | Disable 2FA for user |
| `/api/events/process` | POST | Process pending events |
| `/api/health` | GET | System health check |
| `/api/backup` | GET | DB snapshot or journal export |

## Events Published

None directly -- core provides the event bus infrastructure (`publishEvent`, `processEvents`, `registerHandler`).

## Events Consumed

The event-handlers-registry registers handlers for:
- `sale.completed` -- Create manager notification

## Key Files

| File | Purpose |
|------|---------|
| `services/auth.ts` | JWT creation/verification, password hashing (bcrypt), RBAC checks |
| `services/events.ts` | `publishEvent()` -- write events to events_log |
| `services/event-handlers.ts` | `processEvents()` -- fetch pending events, run handlers, retry logic |
| `services/event-handlers-registry.ts` | `initializeEventHandlers()` -- register all handlers at startup |
| `services/event-emitters.ts` | Convenience functions to emit typed events from other modules |
| `services/sessions.ts` | Create/list/revoke sessions, device fingerprinting |
| `services/two-factor.ts` | TOTP setup, QR generation, code verification (otpauth) |
| `services/logger.ts` | Structured JSON logging (pino) with request-id |
| `services/rate-limit.ts` | In-memory rate limiter (Redis-ready) |
| `services/audit.ts` | Write to audit_log table |
| `services/journal.ts` | Write to data_journal (append-only double-write) |
| `services/supabase.ts` | Supabase client factory (anon + service role) |
| `services/request-id.ts` | Generate unique request IDs for tracing |
| `services/utils.ts` | Shared utilities (formatPrice, validateIMEI, etc.) |
