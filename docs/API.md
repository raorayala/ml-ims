# ML-IMS API Reference

Base URL (local): `http://localhost:4000/api`  
Machine-readable spec: [`openapi.yaml`](./openapi.yaml)  
Behavior vs planned work: [`ROADMAP.md`](./ROADMAP.md)

Errors return:

```json
{ "error": { "code": "SOME_CODE", "message": "Human readable" } }
```

## Authentication

Most routes require `Authorization: Bearer <JWT>` from `POST /auth/login`.

The web app stores that JWT in **localStorage** and sends it on each request. There is no cookie session, CSRF token, login rate limit, or server-side token revocation (logout only clears the browser).

| Method | Path | Auth | Body / notes |
|--------|------|------|----------------|
| POST | `/auth/login` | Public | `{ username, password }` → `{ token, user }` |
| GET | `/auth/me` | Any role | Current user |
| GET/POST | `/users` | ADMIN | List / create users |
| PATCH | `/users/:userId` | ADMIN | Update role, email, fullName, isActive |
| POST | `/users/:userId/reset-password` | ADMIN | `{ password }` (does not revoke outstanding JWTs) |

Roles: `ADMIN` (full access) · `LAB_USER` (operations + read). Check-out/in and HTTP agent **ignore** client `userId` and bind the session **username** (string on `inventory_transactions.user_id`, not `users.id`).

MCP and the agent CLI are not JWT-authenticated; they pass `userId` in the tool/CLI payload (default `DEFAULT_USER_ID`).

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness (public) |
| GET | `/ready` | Readiness: `SELECT 1` only (public). Does not check migrations, disk, or cron. |

## Dashboard & inventory movements

| Method | Path | Auth | Body / notes |
|--------|------|------|----------------|
| GET | `/dashboard` | Any | Aggregated UI payload |
| POST | `/inventory/check-out` | Any | `{ lotId\|lotNumber, quantity, experimentIdOrProject? }`. Read-then-write; **not** concurrency-safe (see ROADMAP Phase 1). |
| POST | `/inventory/check-in` | Any | `{ lotId\|lotNumber, quantity }` |
| POST | `/inventory/evaluate-thresholds` | ADMIN | Scan all reagents; create Draft POs |

There is **no** FEFO allocate endpoint and **no** barcode-resolve endpoint.

## Master data CRUD

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/suppliers` | Any | List (no pagination/filter) |
| POST | `/suppliers` | ADMIN | Create |
| PUT/DELETE | `/suppliers/:supplierId` | ADMIN | Update / delete (blocked if reagents linked) |
| GET | `/reagents` | Any | List |
| POST/PUT/DELETE | `/reagents…` | ADMIN | Mutate |
| GET | `/lots` | Any | List |
| POST | `/lots` | ADMIN | Create (opening quantity; no receiving ledger) |
| PATCH | `/lots/:lotId` | ADMIN | May set `currentQuantity` and `status` **without** a transaction row, reason, or reorder. Do not use for stock corrections. |
| DELETE | `/lots/:lotId` | ADMIN | Blocked if the lot has any transactions |

Planned: adjustment/disposal endpoints that always append the ledger; PATCH limited to non-stock fields.

## Purchase orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/purchase-orders` | Any | List all |
| POST | `/purchase-orders/draft` | ADMIN | `{ reagentId }` force draft evaluation |
| PATCH | `/purchase-orders/:poId/status` | ADMIN | `{ status }` any of Draft / Pending Approval / Submitted / Received. **No transition guard.** Received does **not** create lots or capture receipt quantity/cost/invoice/lot/expiry. |

There is no `POST …/receive` endpoint yet.

## Reports, ledger, jobs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/reports/stock-summary` | Any | By storage location. `totalQuantity` sums Active qty **across units**. |
| GET | `/reports/consumption?days=30&groupBy=project` | Any | 30/60/90. Project groups can mix units. |
| GET | `/reports/expirations` | Any | 30/60/90 windows using API host local date |
| GET | `/transactions?limit=100` | Any | Newest ledger rows. `limit` default 100, max 500. **No** cursor, filter, search, or sort. |
| POST | `/jobs/quarantine-expired` | ADMIN | Status flip to Quarantined; no reason/ledger |

No CSV/PDF export or saved-report APIs.

## Agent

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/agent/execute` | Any | `{ message }` (actor = session username; body `userId` ignored) |
