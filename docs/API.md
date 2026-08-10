# ML-IMS API Reference

Base URL (local): `http://localhost:4000/api`  
Machine-readable spec: [`openapi.yaml`](./openapi.yaml)

Errors return:

```json
{ "error": { "code": "SOME_CODE", "message": "Human readable" } }
```

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/ready` | Readiness (DB `SELECT 1`) |

## Dashboard & inventory movements

| Method | Path | Body / notes |
|--------|------|----------------|
| GET | `/dashboard` | Aggregated UI payload |
| POST | `/inventory/check-out` | `{ lotId\|lotNumber, quantity, userId, experimentIdOrProject? }` |
| POST | `/inventory/check-in` | `{ lotId\|lotNumber, quantity, userId }` |
| POST | `/inventory/evaluate-thresholds` | Scan all reagents; create Draft POs |

## Master data CRUD

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/suppliers` | List / create |
| PUT/DELETE | `/suppliers/:supplierId` | Update / delete (blocked if reagents linked) |
| GET/POST | `/reagents` | List / create |
| PUT/DELETE | `/reagents/:reagentId` | Update / delete (blocked if lots exist) |
| GET/POST | `/lots` | List / create |
| PATCH/DELETE | `/lots/:lotId` | Update / delete (blocked if transactions exist) |

## Purchase orders

| Method | Path | Description |
|--------|------|-------------|
| GET | `/purchase-orders` | List all |
| POST | `/purchase-orders/draft` | `{ reagentId }` force draft evaluation |
| PATCH | `/purchase-orders/:poId/status` | `{ status }` one of Draft, Pending Approval, Submitted, Received |

## Reports & jobs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports/stock-summary` | By storage location |
| GET | `/reports/consumption?days=30&groupBy=project` | 30/60/90 trends |
| GET | `/reports/expirations` | 30/60/90 windows |
| GET | `/transactions?limit=100` | Audit ledger |
| POST | `/jobs/quarantine-expired` | Manual quarantine sweep |

## Agent

| Method | Path | Body |
|--------|------|------|
| POST | `/agent/execute` | `{ message, userId? }` |
