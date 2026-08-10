# ML-IMS Architecture

## System context

```mermaid
flowchart LR
  User[Lab technician / manager] --> Web[Next.js dashboard]
  User --> AgentCLI[Agent CLI]
  Cursor[Cursor / MCP client] --> MCP[MCP stdio server]
  Web --> API[Express API]
  AgentCLI --> Core[Core domain services]
  MCP --> Core
  API --> Core
  Core --> DB[(SQLite or PostgreSQL)]
```

## Monorepo packages

| Path | Responsibility |
|------|----------------|
| `apps/web` | React UI: dashboard, scanner, admin forms, PO actions |
| `apps/api` | REST API, request logging, expiration cron |
| `apps/mcp` | MCP tool surface for AI agents |
| `apps/agent` | Natural-language execution loop (CLI) |
| `packages/shared` | Zod schemas, `AppError`, shared enums |
| `packages/db` | Prisma schema, migrations, seed, client export |
| `packages/core` | Check-out/in, reorder, reports, master-data CRUD, agent parser |

## Domain flow — check-out

```mermaid
sequenceDiagram
  participant U as User/UI/Agent
  participant A as API / MCP
  participant C as inventoryService
  participant D as Database
  U->>A: check-out (lot, qty, user, project)
  A->>C: checkOutReagent
  C->>D: BEGIN transaction
  C->>D: lock/read Active lot
  alt insufficient or not Active
    C-->>A: AppError
  else ok
    C->>D: update lot quantity/status
    C->>D: insert inventory_transactions
    C->>C: evaluateAndReorder
    opt stock <= threshold and no open PO
      C->>D: insert purchase_orders Draft + alert JSON
    end
    C->>D: COMMIT
    C-->>A: result
  end
```

## Data model (logical ERD)

```mermaid
erDiagram
  SUPPLIERS ||--o{ REAGENTS : supplies
  REAGENTS ||--o{ INVENTORY_LOTS : has
  REAGENTS ||--o{ PURCHASE_ORDERS : reorder
  SUPPLIERS ||--o{ PURCHASE_ORDERS : fulfills
  INVENTORY_LOTS ||--o{ INVENTORY_TRANSACTIONS : audited_by

  SUPPLIERS {
    uuid supplier_id PK
    string supplier_name
    string contact_email
  }
  REAGENTS {
    uuid reagent_id PK
    string reagent_name
    string unit_of_measure
    decimal min_threshold_quantity
    decimal reorder_quantity
    uuid supplier_id FK
  }
  INVENTORY_LOTS {
    uuid lot_id PK
    uuid reagent_id FK
    string lot_number
    decimal current_quantity
    string status
    date expiration_date
  }
  INVENTORY_TRANSACTIONS {
    uuid transaction_id PK
    uuid lot_id FK
    string transaction_type
    decimal quantity_changed
    string user_id
    timestamp timestamp
  }
  PURCHASE_ORDERS {
    uuid po_id PK
    uuid reagent_id FK
    uuid supplier_id FK
    decimal suggested_quantity
    string status
  }
```

## Reorder formula

When Active stock ≤ `min_threshold_quantity` and no open PO (`Draft` | `Pending Approval` | `Submitted`):

```
suggested = max(reorder_quantity, avg_monthly_consumption * 1.5 - current_stock)
```

`avg_monthly_consumption` is total check-outs in the last 90 days ÷ 3.

## Trust boundaries

- Current release is intended for trusted lab networks.
- Mutating APIs accept a free-text `userId` (no login yet).
- Do not expose the API to the public internet without adding authentication.
