# ML-IMS — User Requirements Specification

**Product:** Microbiology Laboratory Inventory Management System (ML-IMS)  
**Repository:** [https://github.com/raorayala/ml-ims](https://github.com/raorayala/ml-ims)  
**Audience:** Lab technicians, inventory managers, lab supervisors, and integrators  
**Release described:** 1.2.x (implemented) plus planned requirements in §8  
**Traceability for gaps:** [ROADMAP.md](./ROADMAP.md)

---

## 1. Purpose

Provide an automated, auditable, real-time system for tracking microbiology laboratory reagents and lots, recording inventory movements, alerting on low stock, drafting purchase orders, and supporting natural-language / MCP-driven operations — using free/unpaid software only.

This specification distinguishes **implemented** requirements (§3–4) from **known gaps** (§7) and **planned** requirements (§8). Where implementation is weaker than the original wording, the requirement stays a Must and the gap is explicit.

---

## 2. Stakeholders & Roles

| Role | Needs |
|------|--------|
| Lab technician | Check out / check in reagents quickly; associate use with project/experiment; optional barcode scan that resolves a lot |
| Inventory manager | Monitor stock by location **in compatible units**; act on low-stock alerts; review and **receive** POs into lots |
| Lab supervisor | Audit consumption trends; expiration visibility; **complete** immutable transaction history (including adjustments) |
| Integrator / AI operator | Call MCP tools or agent loop from Cursor / CLI with a **bound** service identity |

Application roles today: `ADMIN` (master data, POs, users, jobs) and `LAB_USER` (operations + read).

---

## 3. Functional Requirements (current product)

### 3.1 Inventory master data

| ID | Requirement | Priority | Implementation notes |
|----|-------------|----------|----------------------|
| FR-01 | Maintain **suppliers** (name, email, phone, account number) | Must | API create/update/delete; dashboard **create only** |
| FR-02 | Maintain **reagents** (name, unit of measure, min threshold, reorder quantity, supplier, optional barcode) | Must | Same: API full CRUD; dashboard create only |
| FR-03 | Maintain **inventory lots** (lot number, quantity, storage location, expiration date, status) | Must | `PATCH /lots` can change quantity/status **without** a ledger row (gap G-02) |
| FR-04 | Units of measure limited to: `mL`, `L`, `g`, `kg`, `vials`, `packs` | Must | Zod on API; **not** a database enum/CHECK (G-05) |
| FR-05 | Lot status values: `Active`, `Depleted`, `Expired`, `Quarantined` | Must | Same as FR-04 |

### 3.2 Check-out / check-in

| ID | Requirement | Priority | Implementation notes |
|----|-------------|----------|----------------------|
| FR-06 | Check-out only from lots with status `Active` | Must | Enforced in service after a non-locking read |
| FR-07 | Reject check-out when requested quantity exceeds current lot quantity | Must | Same; **not atomic** under concurrency (G-01) |
| FR-08 | Perform stock update and audit insert inside an isolated database transaction | Must | Prisma `$transaction` used; default isolation does **not** serialize concurrent decrements on PostgreSQL (G-01) |
| FR-09 | Append an immutable row to `inventory_transactions` for every **stock** movement | Must | Check-out/in only; admin quantity edits and expiration quarantine skip the ledger (G-02) |
| FR-10 | Recalculate total Active stock for the reagent after check-out | Must | Implemented on check-out path |
| FR-11 | Support check-in (return) that increases lot quantity and writes an audit row | Must | Same concurrency caveat as check-out |
| FR-12 | Capture acting user id and optional experiment/project code | Must | API uses JWT **username** string; not `users.id` FK (G-04). MCP/CLI accept caller `userId` (G-12) |
| FR-13 | Dashboard supports HTML5 barcode/QR scan to autofill lot/barcode values | Should | Autofill only; does not resolve or validate a lot-level barcode (G-06) |

### 3.3 Automated reorder & alerts

| ID | Requirement | Priority | Implementation notes |
|----|-------------|----------|----------------------|
| FR-14 | After check-out, compare total Active stock to `min_threshold_quantity` | Must | Implemented |
| FR-15 | If stock ≤ threshold and no open PO exists (`Draft` / `Pending Approval` / `Submitted`), create a `Draft` purchase order | Must | Implemented |
| FR-16 | Suggested quantity = `max(reorder_quantity, avg_monthly_consumption × 1.5 − current_stock)` | Must | 90-day check-outs ÷ 3; mixed units can distort averages (G-07) |
| FR-17 | Persist a low-stock alert payload with the draft PO | Must | JSON on `alert_payload`; **no** email/Teams/Slack, ack, or history (G-08) |
| FR-18 | Support explicit threshold evaluation across all reagents | Must | `POST /inventory/evaluate-thresholds` (ADMIN) |

### 3.4 Reporting & analytics

| ID | Requirement | Priority | Implementation notes |
|----|-------------|----------|----------------------|
| FR-19 | Stock summary grouped by storage location with expiration highlights | Must | Location `totalQuantity` **sums incompatible units** (G-07) |
| FR-20 | Consumption rates for rolling 30 / 60 / 90 days, by project or reagent | Must | Project grouping can mix units (G-07) |
| FR-21 | Expiration tracking for lots within 30 / 60 / 90 days | Must | Windows are report buckets, not configurable warning lead times (G-08) |
| FR-22 | Cron job marks Active lots as `Quarantined` at 00:00 on expiration date | Must | Uses **server local** midnight, not a lab timezone (G-13); no quarantine reason/ledger |
| FR-23 | Dashboard shows reagent list, low-stock alerts, open POs, transaction log, consumption chart | Must | Transaction list is newest-first with a **limit**, not a full explorer (G-09) |

### 3.5 MCP & agentic AI

| ID | Requirement | Priority | Implementation notes |
|----|-------------|----------|----------------------|
| FR-24 | Expose MCP tools: `check_out_reagent`, `check_in_reagent`, `evaluate_thresholds`, `generate_draft_po`, `get_consumption_report` | Must | Implemented; tools accept caller `userId` (G-12) |
| FR-25 | Agent loop parses natural language (e.g. “I took 50mL of Lot 902 for Project EXP-101”) into tool calls | Must | Rule-based parser; API binds session user |
| FR-26 | Agent executes reorder logic automatically after applicable mutations | Must | Via `checkOutReagent` |
| FR-27 | Optional free local LLM (Ollama) when enabled; rule-based parser works offline by default | Should | Implemented |

### 3.6 Data & audit

| ID | Requirement | Priority | Implementation notes |
|----|-------------|----------|----------------------|
| FR-28 | Relational schema with primary keys, foreign keys, indexes, and **enum/CHECK constraints** | Must | PKs/FKs/indexes exist; statuses/units are strings (G-05) |
| FR-29 | Transaction ledger is append-only (no update/delete of historical movements in normal workflows) | Must | App does not expose ledger update/delete; DB user **can** mutate rows; admin lot PATCH bypasses insert (G-02, G-05) |
| FR-30 | Purchase order statuses: `Draft`, `Pending Approval`, `Submitted`, `Received` | Must | Any status may be written; no guarded transitions or goods receipt (G-03) |

### 3.7 Authentication (implemented 1.2)

| ID | Requirement | Priority | Implementation notes |
|----|-------------|----------|----------------------|
| FR-31 | JWT login with roles `ADMIN` and `LAB_USER` | Must | Bearer token; web stores JWT in **localStorage** (G-11) |
| FR-32 | Mutating inventory on the HTTP API uses the authenticated session as actor | Must | Username string, not User PK (G-04) |

---

## 4. Non-Functional Requirements

| ID | Requirement | Implementation notes |
|----|-------------|----------------------|
| NFR-01 | Prefer free/unpaid stack (Node.js, Next.js, Prisma, SQLite/PostgreSQL, MCP SDK, optional Ollama) | Met |
| NFR-02 | Validate all mutating API inputs (Zod) with clear error codes/messages | Met for HTTP; DB can still store invalid enums (G-05) |
| NFR-03 | Local development runnable without paid cloud services | Met (`npm run setup`) |
| NFR-04 | Modular monorepo: `apps/*` + `packages/*` | Met |
| NFR-05 | Responsive web dashboard usable on desktop and typical lab workstation displays | Met for current screens |
| NFR-06 | Secrets (`.env`) never committed to Git | Met by policy |
| NFR-07 | Concurrent clients must not over-withdraw or lose stock updates | **Not met** (G-01) |
| NFR-08 | Structured logs, metrics, error tracking; health checks that verify dependencies | Partial: request log, `/health`, `/ready` = `SELECT 1` (G-14) |
| NFR-09 | PostgreSQL is a first-class path with migrations, backup/restore docs | SQLite default; Postgres via provider switch + `db:push` (G-14) |
| NFR-10 | Login rate limiting, session revocation, XSS-resistant token storage | **Not met** (G-11) |

---

## 5. Out of Scope (current charter)

These remain out of scope unless a later charter adds them. They are **not** substitutes for the gaps in §7.

- Full supplier EDI / automated vendor portals  
- Multi-tenant SaaS authentication / SSO  
- Mobile native apps  
- Paid LLM provider hard dependency  
- GLP / 21 CFR Part 11 certification package (IQ/OQ/PQ, qualified electronic signatures)

---

## 6. Acceptance Criteria (smoke — current release)

1. Fresh clone from GitHub can be set up with documented setup steps.  
2. Seed data loads Lot `902` (Ethanol Absolute) and low-stock reagents.  
3. Check-out of 50 mL from Lot `902` for `EXP-101` succeeds and appears in the transaction log.  
4. Threshold evaluation creates Draft POs for reagents below minimum.  
5. Dashboard at `http://localhost:3000` shows reagents, alerts, and transactions.  
6. Agent phrase above executes the same check-out path successfully (CLI uses `DEFAULT_USER_ID`).  
7. Unauthenticated API mutations (other than login/health/ready) are rejected.

These criteria do **not** yet include parallel check-out, PO goods receipt, or ledger completeness for admin edits.

---

## 7. Known gaps (current vs stated)

IDs are referenced from [ROADMAP.md](./ROADMAP.md). Priority follows the recommended implementation order.

| ID | Gap | Affects |
|----|-----|---------|
| G-01 | Check-out/in is read-then-write, not an atomic conditional decrement or row lock | FR-07, FR-08, NFR-07 |
| G-02 | `updateLot` and expiration quarantine change stock/status without a ledger row, reason, or actor | FR-09, FR-29 |
| G-03 | PO status can move arbitrarily; Received does not create lots or capture receipt data | FR-30 |
| G-04 | Transactions store free-text `user_id` (username), not `users.id` | FR-12 |
| G-05 | Statuses/units/roles are strings; ledger immutability is not DB-enforced | FR-04, FR-05, FR-28, FR-29 |
| G-06 | No FEFO allocation; barcode scan autofills text only | FR-13 |
| G-07 | Location and project totals mix incompatible units | FR-16, FR-19, FR-20 |
| G-08 | No outbound notifications, ack, escalation, alert history, or expiry lead-time config | FR-17, FR-21 |
| G-09 | Lists lack pagination/filter/sort/search/export; transactions support `limit` only | FR-23 |
| G-10 | Dashboard cannot update/delete suppliers, reagents, or lots | FR-01–FR-03 |
| G-11 | JWT in `localStorage`; no cookie session, CSRF plan, rate limit, or revocation | FR-31, NFR-10 |
| G-12 | MCP/CLI accept caller-supplied `userId`; tool calls are not fully audited | FR-12, FR-24 |
| G-13 | Expiry job uses server local date, not a laboratory timezone | FR-22 |
| G-14 | Ops: thin health, no structured telemetry, Postgres not migration-first, no backup/restore runbook | NFR-08, NFR-09 |

Lifecycle (cycle count, transfer, split/merge, recall, retained samples), multi-line POs, CSV import, and saved reports are **unbuilt** capabilities (planned FR-40+), not defects against a shipped workflow.

---

## 8. Planned requirements

Implement in roadmap order: integrity → PO/traceability → security → operations/reporting → UX scale-up.

### 8.1 Phase 1 — Integrity

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-33 | Atomic stock decrement: succeed only if lot is Active and `quantity >= requested` (or equivalent serializable / `FOR UPDATE` lock) | Must |
| FR-34 | Parallel check-out tests prove no over-withdrawal and no lost updates on SQLite and PostgreSQL | Must |
| FR-35 | Quantity and stock-status changes go through adjustment/disposal (or check-out/in) and **always** insert a ledger row with reason and actor | Must |
| FR-36 | Generic lot update cannot silently change quantity | Must |

### 8.2 Phase 2 — Receiving and traceability

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-37 | PO status transitions are directed (no skip/backwards except defined cancel/reject) | Must |
| FR-38 | Receive PO captures quantity, cost, invoice, lot number, expiry, location; creates/updates lots; writes ledger; records discrepancies | Must |
| FR-39 | PO approval stores identity, timestamp, and comments | Should |
| FR-40 | Lots store manufacturer, catalog number, received date, storage/temperature requirements | Must |
| FR-41 | COA/SDS attachments; quarantine, disposal, and adjustment reasons; approvals where required | Must |
| FR-42 | `inventory_transactions.user_id` is a foreign key to `users.id` | Must |
| FR-43 | Database enums or CHECK constraints for role, unit, lot status, transaction type, PO status | Must |
| FR-44 | Database prevents UPDATE/DELETE on historical `inventory_transactions` for the app role | Must |

### 8.3 Phase 3 — Security

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-45 | Session tokens in HttpOnly, Secure, SameSite cookies with CSRF protection | Must |
| FR-46 | Login rate limiting; auth success/failure audit events | Must |
| FR-47 | Logout and admin disable revoke the session/token | Must |
| FR-48 | MCP/CLI use a configured service identity or OS/authenticated boundary; every tool call is logged | Must |

### 8.4 Phase 4 — Operations and reporting

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-49 | FEFO: suggest or auto-select the earliest-expiring Active lot for a reagent | Should |
| FR-50 | Lot-level barcode resolves and validates to exactly one lot | Should |
| FR-51 | Reports never present a single total that mixes incompatible units | Must |
| FR-52 | Notifications (email and/or Teams/Slack), acknowledgment, escalation, alert history | Should |
| FR-53 | Configurable expiration-warning lead times | Should |
| FR-54 | Explicit laboratory timezone (`LAB_TIMEZONE`) for expiry and calendar reports | Must |
| FR-55 | Cycle counts / reconciliation, location transfers, lot split/merge, recalls, retained samples | Should |
| FR-56 | Supplier SKU/price/lead time; multi-line POs; PO document export/email | Should |

### 8.5 Phase 5 — UX, import, operations

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-57 | Server-side pagination, filtering, search, and sorting on list endpoints including the audit explorer | Must |
| FR-58 | CSV/PDF export, saved reports, auditable export mechanism | Should |
| FR-59 | Dashboard supports update/delete (and adjust/dispose) for suppliers, reagents, and lots | Must |
| FR-60 | Validated CSV import and bulk update | Should |
| FR-61 | Documented backup/restore, scheduled backups, restore drills | Should |
| FR-62 | Structured logs, metrics, error tracking; health checks beyond `SELECT 1` | Should |
| FR-63 | PostgreSQL migrations as the supported apply path | Must |

---

## 9. Related documents

- [Roadmap and known gaps](./ROADMAP.md)  
- [Setup from GitHub](./SETUP.md)  
- [User Guide](./USER_GUIDE.md)  
- [Architecture](./ARCHITECTURE.md)  
- [API](./API.md)  
- [Testing](./TESTING.md)  
- [Security](../SECURITY.md)  
- [Project README](../README.md)  
