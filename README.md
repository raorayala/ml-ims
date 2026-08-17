# ML-IMS — Microbiology Laboratory Inventory Management System

Inventory tracking, audit ledger, automated reorder drafts, MCP tool server, and an agentic natural-language execution loop for a trusted laboratory network.

**Repository:** [https://github.com/raorayala/ml-ims](https://github.com/raorayala/ml-ims)

**Stack (all free / unpaid):** Next.js, Tailwind CSS, Lucide, Recharts, html5-qrcode, Node.js + Express + TypeScript, Prisma, SQLite (default) or PostgreSQL via Docker, Model Context Protocol SDK, optional local Ollama LLM.

Current release (**1.2.x**) is suitable for single-lab intranet use and demo workflows. It is **not** yet concurrent-safe on PostgreSQL, does not receive POs into stock, and does not enforce an append-only ledger for admin quantity edits. See [docs/ROADMAP.md](./docs/ROADMAP.md).

## Documentation

| Document | Description |
|----------|-------------|
| [docs/SETUP.md](./docs/SETUP.md) | Clone from GitHub, install, configure `.env`, run API + web |
| [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) | Dashboard, check-out/in, admin create-forms, PO status, agent, reports |
| [docs/USER_REQUIREMENTS.md](./docs/USER_REQUIREMENTS.md) | Functional / non-functional requirements, gaps, planned FRs |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Known gaps and recommended implementation order |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System context, ERD, check-out sequence (current vs target) |
| [docs/API.md](./docs/API.md) / [docs/openapi.yaml](./docs/openapi.yaml) | REST reference + OpenAPI |
| [docs/TESTING.md](./docs/TESTING.md) | Vitest + CI + manual smoke + planned suites |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Build, health probes, Docker, Postgres, ops gaps |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Branching, integrity rules, PR checks |
| [CHANGELOG.md](./CHANGELOG.md) | Release notes |
| [SECURITY.md](./SECURITY.md) | Vulnerability reporting and current posture |
| [LICENSE](./LICENSE) | MIT |

## Clone & run (quick)

```bash
git clone https://github.com/raorayala/ml-ims.git
cd ml-ims
npm run setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Full steps and troubleshooting: [docs/SETUP.md](./docs/SETUP.md).

## Monorepo layout

```
apps/
  api/       REST API + expiration cron
  web/       Next.js dashboard
  mcp/       MCP server (stdio tools)
  agent/     CLI agent loop
packages/
  db/        Prisma schema, migrations folder, seed
  shared/    Zod schemas + AppError
  core/      Checkout/check-in, reorder, reports, agent parser
```

## Quick start

```bash
# Node 20+
# Open this folder in VS Code/Cursor: c:\Users\Admin\Projects\ml-ims
# (or File → Open Workspace from File… → ml-ims.code-workspace)

npm run setup          # create .env, install, generate Prisma client, push schema, seed
npm run dev            # API :4000 + Web :3000
```

Open [http://localhost:3000](http://localhost:3000). Seed login: `lab-tech-001` / `changeme123` (or `admin` / `changeme123`).

### Troubleshooting (Windows / VS Code)

1. **Open the correct folder** — the app is `ml-ims`, not `job-search-agent`.
2. **Prisma `EPERM` / `query_engine-windows.dll.node`** — another Node process is locking the Prisma engine. Stop running API/dev terminals, then:
   ```bash
   # PowerShell
   Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
   npm run db:generate
   ```
3. **Many red squiggles in the editor** — run `npm run setup` once, then in VS Code: Command Palette → **TypeScript: Select Workspace Version**. Reload the window.
4. **`npm warn Unknown env config "devdir"`** — harmless npm config warning; not a project compile error.
5. **`npm audit` high issues in `next`/`postcss`/`sharp`** — upstream Next.js transitive deps; optional later upgrade to Next 16.

### Optional PostgreSQL

PostgreSQL is supported but is **not** yet a migration-first production path. Concurrent check-out is unsafe until Phase 1 (atomic decrement / row lock).

```bash
docker compose up -d
# set DATABASE_URL in .env and packages/db/.env:
# postgresql://mlims:mlims@localhost:5432/mlims?schema=public
# then change provider = "postgresql" in packages/db/prisma/schema.prisma
npm run db:push
npm run db:seed
```

Prefer `npm run db:migrate` once Postgres is the target database ([docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)).

## Core workflows (current)

1. **Check-out** — validates Active lot + quantity **inside a Prisma transaction**, writes `inventory_transactions`, recalculates reagent stock, and if `total <= min_threshold` creates a `Draft` PO using  
   `max(reorder_quantity, avg_monthly_consumption * 1.5 - current_stock)` (skips if an open PO exists). The quantity write is **not** a conditional `quantity >= requested` update; two concurrent clients can over-withdraw.
2. **Check-in** — returns quantity to a lot and appends an audit row (same concurrency caveat).
3. **Admin lot PATCH** — can change quantity and status **without** a ledger row. Do not use it as a substitute for check-out/in.
4. **Purchase orders** — status can be set to Draft / Pending Approval / Submitted / Received. **Received does not create stock** or capture receipt fields.
5. **Expiration cron** — marks Active lots as `Quarantined` at midnight on `expiration_date` using the **API host local date** (`CRON_SCHEDULE`, default `0 0 * * *`). No quarantine reason or ledger row.
6. **Reports** — stock by location, 30/60/90-day consumption, expiration windows. Location and project **totals can mix units** (mL + g + vials). Use per-reagent rows.

## MCP tools

Server: `npm run dev:mcp`

| Tool | Purpose |
|------|---------|
| `check_out_reagent` | Stock deduction + audit + reorder (`userId` is caller-supplied) |
| `check_in_reagent` | Return stock + audit |
| `evaluate_thresholds` | Scan all reagents for low stock |
| `generate_draft_po` | Force draft PO evaluation for one reagent |
| `get_consumption_report` | Rolling consumption analytics |

See `mcp.json.example` for Cursor MCP registration. Treat MCP as a privileged local boundary ([SECURITY.md](./SECURITY.md)).

## Agentic loop

Rule-based NL parser (free, offline). Optional Ollama when `AGENT_USE_LLM=true`.

```bash
npm run start -w @ml-ims/agent -- "I took 50mL of Lot 902 for Project EXP-101"
```

Or use **Run agent** on the dashboard / `POST /api/agent/execute` (HTTP actor = session username).

## Key API routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | JWT login |
| GET | `/api/dashboard` | Reagents, alerts, txs, POs |
| POST | `/api/inventory/check-out` | Check-out workflow |
| POST | `/api/inventory/check-in` | Check-in workflow |
| POST | `/api/inventory/evaluate-thresholds` | Reorder sweep (ADMIN) |
| PATCH | `/api/purchase-orders/:id/status` | Set PO status (ADMIN; no goods receipt) |
| GET | `/api/reports/stock-summary` | Stock by location (mixed-unit total) |
| GET | `/api/reports/consumption` | Consumption trends |
| GET | `/api/reports/expirations` | 30/60/90-day expiry |
| GET | `/api/transactions?limit=` | Recent ledger rows (max 500) |
| POST | `/api/jobs/quarantine-expired` | Manual quarantine job (ADMIN) |
| POST | `/api/agent/execute` | NL agent loop |

## Seed highlights

- Lot **902** — Ethanol Absolute (good for the sample agent phrase)
- Low stock — Ampicillin (4 vials), Tryptic Soy Agar (85 g)
- Users — `admin` / `lab-tech-001` / `lab-tech-002` (password `changeme123`)
