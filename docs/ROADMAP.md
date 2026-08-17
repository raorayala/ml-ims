# ML-IMS — Roadmap and known gaps

**Status:** Current release is **1.2.x**. This document records product, integrity, and operations gaps against the stated laboratory inventory goals, and the recommended implementation order.

Related: [USER_REQUIREMENTS.md](./USER_REQUIREMENTS.md) (FR/NFR IDs) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [SECURITY.md](../SECURITY.md) · [TESTING.md](./TESTING.md)

---

## 1. Recommended implementation order

Do not start UX scale-up or integrations until inventory and audit integrity are correct. Later phases assume earlier phases are in place.

| Phase | Theme | Why first |
|-------|--------|-----------|
| **1** | Inventory / audit integrity | Concurrent check-out can lose updates or over-withdraw; admin lot edits bypass the ledger |
| **2** | PO receiving and traceability | POs never create stock; lots lack COA/SDS, manufacturer, quarantine reason, User FK |
| **3** | Security / session hardening | JWT in `localStorage`, no rate limit or revocation; MCP/CLI accept caller `userId` |
| **4** | Operational workflows and reporting | FEFO, unit-safe totals, cycle counts, transfers, adjustments, alerts with lead time |
| **5** | Integrations and UX scale-up | Pagination, search, export, saved reports, full admin UI, notifications, import/backup |

---

## 2. Phase 1 — Inventory and audit integrity

### 2.1 Concurrent check-out / check-in (P0)

**Current:** `checkOutReagent` / `checkInReagent` run inside `prisma.$transaction`, re-read the lot, then write the calculated quantity. There is no row lock (`SELECT … FOR UPDATE`) and no conditional decrement (`UPDATE … WHERE quantity >= requested`). Prisma’s default isolation on PostgreSQL is typically **Read Committed**, so two concurrent clients can both pass the quantity check and over-withdraw or lose an update.

**Target:**

- Atomic conditional update: decrement only if `status = Active` and `current_quantity >= requested`.
- Or serializable transaction / `FOR UPDATE` row lock on the lot row.
- Same pattern for check-in (avoid lost updates when restoring stock).
- Automated **parallel check-out** tests (SQLite and PostgreSQL).

Code: `packages/core/src/services/inventoryService.ts` (`checkOutReagent`).

### 2.2 Quantity changes must always append a ledger row (P0)

**Current:** Check-out and check-in write `inventory_transactions`. `updateLot` can change `currentQuantity` and `status` with no transaction, reason, actor, or reorder evaluation. That undermines the “immutable audit” claim.

**Target:**

- Remove quantity/status mutation from generic lot PATCH (or restrict PATCH to non-stock fields: location, expiration metadata).
- Explicit **adjustment** and **disposal** workflows: reason, actor, optional approval; always insert a ledger row (`Adjustment` / `Disposal`).
- Recalculate Active stock and evaluate reorder after stock-affecting adjustments.
- Ledger remains append-only in application workflows; see Phase 2/3 for DB enforcement.

Code: `packages/core/src/services/masterDataService.ts` (`updateLot`).

### 2.3 Actor identity on the ledger (P0, shared with Phase 2)

**Current:** `inventory_transactions.user_id` is a free-text string (API binds JWT **username**; MCP/CLI accept caller-supplied `userId`). There is no FK to `users`.

**Target:** Store `users.id` (UUID) on transactions; keep username only as denormalized display if needed. MCP/CLI must not accept an arbitrary actor (Phase 3).

---

## 3. Phase 2 — PO receiving and compliance traceability

### 3.1 Controlled PO status workflow (P0)

**Current:** `PATCH /purchase-orders/:poId/status` sets any of `Draft` | `Pending Approval` | `Submitted` | `Received`, including backwards jumps and Draft → Received. Receiving does not capture quantity, cost, invoice, lot number, expiry, or create stock.

**Target:**

- Allowed transitions only, e.g. Draft → Pending Approval → Submitted → Received (plus explicit cancel/reject if added).
- Record approver identity, timestamp, and comments.
- **Receive PO** endpoint: received quantity, unit cost, invoice reference, lot number, expiration, storage location; create or update lots; write receiving/adjustment ledger rows; handle over/under-receipt discrepancies.

Code: `apps/api/src/routes/index.ts` (PO status patch).

### 3.2 Lot traceability fields and workflows (P1)

Lots need (schema + UI + API):

- Manufacturer and catalog number
- Received date
- COA / SDS attachments
- Temperature / storage requirements
- Quarantine and disposal **reason**
- Adjustment **reason**
- Approval records where required

Expiration quarantine should record a reason and a ledger/audit event, not only flip `status`.

### 3.3 Database constraints vs application strings (P1)

**Current:** Role, unit of measure, lot status, transaction type, and PO status are `String` columns. Zod validates the API. A direct SQL change can store invalid values. Ledger immutability is not enforced by DB grants or triggers.

**Target (PostgreSQL as first-class path):**

- Native enums or `CHECK` constraints for statuses and units.
- Restrict `UPDATE`/`DELETE` on `inventory_transactions` (trigger or role privileges).
- Prisma migrations (`npm run db:migrate`) as the supported Postgres apply path, not only `db:push`.

Code: `packages/db/prisma/schema.prisma`.

---

## 4. Phase 3 — Security and session hardening

| Gap | Current | Target |
|-----|---------|--------|
| Web token storage | JWT in browser `localStorage` (`apps/web/src/lib/api.ts`) | HttpOnly, Secure, SameSite cookies + CSRF protection |
| Login abuse | No rate limit | Login rate limiting and lockout/alerting |
| Session lifecycle | JWT until expiry; no server-side revoke | Session/token revocation (logout, admin disable, password reset) |
| Auth audit | Login not written to inventory/security log | Auth events (login success/fail, logout, role change) |
| MCP / CLI actor | Caller-supplied `userId` (`apps/mcp/src/index.ts`) | Configured service identity, local OS identity, or authenticated MCP boundary; log every tool call |
| Health | `/ready` runs `SELECT 1` | Dependency checks (DB + disk/migrations as appropriate) |

See [SECURITY.md](../SECURITY.md).

---

## 5. Phase 4 — Operational workflows and reporting

### 5.1 FEFO and barcodes

- Suggest/select the **earliest-expiring Active** lot for a reagent (FEFO).
- Lot-level barcode: resolve and **validate** scanned codes to a specific lot (today the scanner only autofills a text field).

### 5.2 Unit-safe reporting

Location `totalQuantity` and project consumption **sum quantities across reagents**. Mixing `mL`, `g`, and `vials` is meaningless.

**Target:** Report separately by `unit_of_measure`, or convert only through an explicit conversion model. Never present a single mixed-unit total as a stock figure.

Code: `packages/core/src/services/reportingService.ts`.

### 5.3 Alerts and notifications

- Email / Teams / Slack (or equivalent) for low stock and expiry
- Escalation and acknowledgment
- Alert history
- Configurable expiration-warning **lead times** (not only 30/60/90 day report buckets)

### 5.4 Laboratory timezone

Expiration cron uses the **API process local date** (`new Date()` + `setHours(0,0,0,0)`).

**Target:** Explicit `LAB_TIMEZONE` (IANA) for “calendar day” expiry and reports.

Code: `apps/api/src/services/expirationCron.ts`.

### 5.5 Lifecycle controls

Inventory counts / cycle counts, reconciliation, stock transfers between locations, controlled adjustments, lot split/merge, recalls, retained-sample tracking.

### 5.6 PO operational extras

Supplier SKU / pricing / lead times, multi-line orders, export/email of PO documents, receipt discrepancy handling (builds on Phase 2 receive flow).

---

## 6. Phase 5 — Integrations and UX scale-up

| Area | Current | Target |
|------|---------|--------|
| Lists / audit explorer | `GET /transactions?limit=` (cap 500), no filter/sort/search | Server-side pagination, filtering, search, sorting; full transaction explorer |
| Export | None | CSV/PDF export, saved reports, auditable export |
| Web admin | Create suppliers/reagents/lots only; copy says deletes are via API | Full update/delete (and adjust/dispose) in the dashboard |
| Import / backup | Seed script only | Validated CSV import, bulk update, scheduled backup, restore drills, documented backup/restore |
| Observability | `console.log` request/cron lines | Structured logs, metrics, error tracking |
| Ops docs | Postgres via `db:push` + provider edit | First-class Postgres migrations, backup/restore runbooks, richer health |

---

## 7. Test coverage to add (with the matching phase)

Current automated tests: shared Zod, inventory check-out/reorder (single-threaded SQLite), agent parser. See [TESTING.md](./TESTING.md).

| Tests | Phase |
|-------|--------|
| Parallel / concurrent check-out (lost update, over-withdrawal) | 1 |
| Adjustment/disposal always writes ledger; `updateLot` cannot silent-change qty | 1 |
| API authentication and authorization (role matrix) | 3 (can start earlier) |
| PO allowed transitions; receive creates lots and ledger | 2 |
| Expiry job respects `LAB_TIMEZONE` | 4 |
| DB enum/check constraint rejection of invalid status/unit | 2 |
| Browser/component tests for dashboard admin and checkout | 5 |
| Login rate limit / cookie session (when implemented) | 3 |

`npm test` requires write access to package `dist/` (TypeScript compile). That is an environment constraint, not a product defect.

---

## 8. Explicitly still out of scope (unless a later charter)

- Full supplier EDI
- Multi-tenant SaaS / SSO (beyond a single lab IdP, if added later)
- Native mobile apps
- Paid LLM hard dependency
- GLP / 21 CFR Part 11 certification package (electronic signatures, complete IQ/OQ/PQ) — Phase 2–3 are **prerequisites**, not certification
