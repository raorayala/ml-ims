# ML-IMS — Microbiology Laboratory Inventory Management System

Production-oriented inventory tracking, immutable audit ledger, automated reorder drafts, MCP tool server, and an agentic natural-language execution loop.

**Stack (all free / unpaid):** Next.js, Tailwind CSS, Lucide, Recharts, html5-qrcode, Node.js + Express + TypeScript, Prisma, SQLite (default) or PostgreSQL via Docker, Model Context Protocol SDK, optional local Ollama LLM.

## Monorepo layout

```
apps/
  api/       REST API + expiration cron
  web/       Next.js dashboard
  mcp/       MCP server (stdio tools)
  agent/     CLI agent loop
packages/
  db/        Prisma schema, migrations, seed
  shared/    Zod schemas + AppError
  core/      Checkout/check-in, reorder, reports, agent parser
```

## Quick start

```bash
# Node 20+
npm run setup          # install, generate Prisma client, push schema, seed
npm run dev            # API :4000 + Web :3000
```

Open [http://localhost:3000](http://localhost:3000).

### Optional PostgreSQL

```bash
docker compose up -d
# set DATABASE_URL in .env and packages/db/.env:
# postgresql://mlims:mlims@localhost:5432/mlims?schema=public
# then change provider = "postgresql" in packages/db/prisma/schema.prisma
npm run db:push
npm run db:seed
```

## Core workflows

1. **Check-out** — validates Active lot + quantity, updates stock in a DB transaction, writes immutable `inventory_transactions`, recalculates reagent stock, and if `total <= min_threshold` creates a `Draft` PO using  
   `max(reorder_quantity, avg_monthly_consumption * 1.5 - current_stock)` (skips if an open PO exists).
2. **Check-in** — returns quantity to a lot and appends an audit row.
3. **Expiration cron** — marks Active lots as `Quarantined` at midnight on `expiration_date` (`CRON_SCHEDULE`, default `0 0 * * *`).
4. **Reports** — stock by location, 30/60/90-day consumption, expiration windows.

## MCP tools

Server: `npm run dev:mcp`

| Tool | Purpose |
|------|---------|
| `check_out_reagent` | Stock deduction + audit + reorder |
| `check_in_reagent` | Return stock + audit |
| `evaluate_thresholds` | Scan all reagents for low stock |
| `generate_draft_po` | Force draft PO evaluation for one reagent |
| `get_consumption_report` | Rolling consumption analytics |

See `mcp.json.example` for Cursor MCP registration.

## Agentic loop

Rule-based NL parser (free, offline). Optional Ollama when `AGENT_USE_LLM=true`.

```bash
npm run start -w @ml-ims/agent -- "I took 50mL of Lot 902 for Project EXP-101"
```

Or use **Run agent** on the dashboard / `POST /api/agent/execute`.

## Key API routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Reagents, alerts, txs, POs |
| POST | `/api/inventory/check-out` | Check-out workflow |
| POST | `/api/inventory/check-in` | Check-in workflow |
| POST | `/api/inventory/evaluate-thresholds` | Reorder sweep |
| POST | `/api/purchase-orders/draft` | Draft PO for reagent |
| GET | `/api/reports/stock-summary` | Stock by location |
| GET | `/api/reports/consumption` | Consumption trends |
| GET | `/api/reports/expirations` | 30/60/90-day expiry |
| POST | `/api/jobs/quarantine-expired` | Manual quarantine job |
| POST | `/api/agent/execute` | NL agent loop |

## Seed highlights

- Lot **902** — Ethanol Absolute (good for the sample agent phrase)
- Low stock — Ampicillin (4 vials), Tryptic Soy Agar (85 g)
