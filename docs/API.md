# ML-IMS API Reference

Base URL (local): `http://localhost:4000/api`  
Machine-readable spec: [`openapi.yaml`](./openapi.yaml)

Errors return:

```json
{ "error": { "code": "SOME_CODE", "message": "Human readable" } }
```

## Authentication

Most routes require `Authorization: Bearer <JWT>` from `POST /auth/login`.

| Method | Path | Auth | Body / notes |
|--------|------|------|----------------|
| POST | `/auth/login` | Public | `{ username, password }` → `{ token, user }` |
| GET | `/auth/me` | Any role | Current user |
| GET/POST | `/users` | ADMIN | List / create users |
| PATCH | `/users/:userId` | ADMIN | Update role, email, fullName, isActive |
| POST | `/users/:userId/reset-password` | ADMIN | `{ password }` |

Roles: `ADMIN` (full access) · `LAB_USER` (operations + read). Check-out/in and agent ignore client `userId` and bind the session username.

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness (public) |
| GET | `/ready` | Readiness (DB `SELECT 1`, public) |

## Dashboard & inventory movements

| Method | Path | Auth | Body / notes |
|--------|------|------|----------------|
| GET | `/dashboard` | Any | Aggregated UI payload |
| POST | `/inventory/check-out` | Any | `{ lotId\|lotNumber, quantity, experimentIdOrProject? }` |
| POST | `/inventory/check-in` | Any | `{ lotId\|lotNumber, quantity }` |
| POST | `/inventory/evaluate-thresholds` | ADMIN | Scan all reagents; create Draft POs |

## Master data CRUD

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/suppliers` | Any | List |
| POST | `/suppliers` | ADMIN | Create |
| PUT/DELETE | `/suppliers/:supplierId` | ADMIN | Update / delete (blocked if reagents linked) |
| GET | `/reagents` | Any | List |
| POST/PUT/DELETE | `/reagents…` | ADMIN | Mutate |
| GET | `/lots` | Any | List |
| POST/PATCH/DELETE | `/lots…` | ADMIN | Mutate |

## Purchase orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/purchase-orders` | Any | List all |
| POST | `/purchase-orders/draft` | ADMIN | `{ reagentId }` force draft evaluation |
| PATCH | `/purchase-orders/:poId/status` | ADMIN | `{ status }` Draft / Pending Approval / Submitted / Received |

## Reports & jobs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/reports/stock-summary` | Any | By storage location |
| GET | `/reports/consumption?days=30&groupBy=project` | Any | 30/60/90 trends |
| GET | `/reports/expirations` | Any | 30/60/90 windows |
| GET | `/transactions?limit=100` | Any | Audit ledger |
| POST | `/jobs/quarantine-expired` | ADMIN | Manual quarantine sweep |

## Agent

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/agent/execute` | Any | `{ message }` (actor = session username) |
