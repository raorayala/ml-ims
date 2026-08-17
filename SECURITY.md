# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |

## Reporting a vulnerability

Please open a **private** GitHub security advisory on [raorayala/ml-ims](https://github.com/raorayala/ml-ims/security), or email the repository owner if advisories are unavailable.

Include:

- Affected version / commit  
- Reproduction steps  
- Impact assessment  

You can expect an acknowledgment within a few days when possible.

## Current security posture (v1.2)

Designed for **trusted laboratory / intranet** use. Do not treat this as internet-hardened.

### Implemented

- REST endpoints (except `/api/health`, `/api/ready`, `/api/auth/login`) require a **JWT** (`Authorization: Bearer`).  
- Roles: `ADMIN` (master data, POs, users, thresholds, jobs) and `LAB_USER` (check-out/in, agent, read views).  
- HTTP check-out/in/agent bind the actor from the authenticated **username** (clients cannot spoof `userId` on those routes).  
- Passwords are stored with **bcrypt**; set a strong `JWT_SECRET` in production.  
- Secrets must live in `.env` (never commit).  
- Prefer binding the API to localhost or a private network.

### Known weaknesses (tracked in [docs/ROADMAP.md](./docs/ROADMAP.md) Phase 3)

| Topic | Current | Risk |
|-------|---------|------|
| Token storage | Web JWT in `localStorage` (`apps/web/src/lib/api.ts`) | Any XSS can steal the session |
| CSRF | Bearer header (not cookies) | Lower CSRF risk today; **will** need CSRF if moving to cookies |
| Login | No rate limit or lockout | Password spraying |
| Sessions | JWT valid until `JWT_EXPIRES_IN`; logout is client-only | Stolen tokens and disabled users remain valid until expiry |
| Auth audit | No login success/fail ledger | Weak incident review |
| MCP / agent CLI | Caller-supplied `userId` (`apps/mcp/src/index.ts`, `DEFAULT_USER_ID`) | Anyone who can run the tool impersonates an actor; tool calls are not a full audit log |
| Ledger | `user_id` is free text, not `users.id`; admin lot PATCH skips the ledger | Incomplete attribution |
| Concurrency | Non-atomic stock decrement | Integrity issue under concurrent clients (especially PostgreSQL) |
| Database | Enums/status as strings; app DB role can UPDATE/DELETE `inventory_transactions` | Direct SQL bypasses Zod and “immutable audit” |

### Target (Phase 3+)

- HttpOnly, Secure, SameSite cookies + CSRF  
- Login rate limiting; auth event log  
- Token/session revocation on logout, password reset, and deactivate  
- MCP/CLI: configured service identity or OS/authenticated boundary; log every tool call  
- Transaction FK to `users`; DB constraints and deny ledger mutation  

## Dependency alerts

Monitor GitHub Dependabot on the repository and upgrade Next.js / transitive packages when advisories apply.
