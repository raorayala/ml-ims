# ML-IMS — Setup Instructions (from GitHub)

**Repository:** [https://github.com/raorayala/ml-ims](https://github.com/raorayala/ml-ims)  

This guide walks you from a clean machine to a running local ML-IMS (API + web dashboard). All required tools are free.

Current 1.2.x is for a trusted lab network and demo workflows. Concurrent PostgreSQL check-out, PO goods receipt, and a complete audit ledger are **not** finished — see [ROADMAP.md](./ROADMAP.md).

---

## 1. Prerequisites

Install before cloning:

| Tool | Version | Notes |
|------|---------|--------|
| [Node.js LTS](https://nodejs.org/) | 20+ (22/24 OK) | Includes `npm` |
| [Git](https://git-scm.com/) | any recent | Clone the repo |
| VS Code or Cursor (optional) | latest | Open `ml-ims.code-workspace` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) (optional) | latest | Only if you want PostgreSQL instead of SQLite |

Verify:

```bash
node -v
npm -v
git --version
```

---

## 2. Clone the repository

### HTTPS

```bash
git clone https://github.com/raorayala/ml-ims.git
cd ml-ims
```

### SSH (if configured)

```bash
git clone git@github.com:raorayala/ml-ims.git
cd ml-ims
```

### GitHub CLI

```bash
gh repo clone raorayala/ml-ims
cd ml-ims
```

**Important:** Open this `ml-ims` folder in your editor (not a parent folder or another project).

- VS Code: **File → Open Folder…** → select `ml-ims`  
- Or **File → Open Workspace from File…** → `ml-ims.code-workspace`

---

## 3. One-command setup

From the repo root:

```bash
npm run setup
```

This will:

1. Create `.env` from `.env.example` (if missing)  
2. Create `packages/db/.env` for Prisma  
3. Install npm workspace dependencies  
4. Generate the Prisma client  
5. Push the database schema (SQLite file by default)  
6. Build shared packages  
7. Seed demo suppliers, reagents, lots, and sample transactions  

### Manual equivalent

```bash
npm run env:init
npm install
npm run db:generate
npm run db:push
npm run build:packages
npm run db:seed
```

---

## 4. Environment variables

Root `.env` (created by setup). Key values:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `file:./dev.db` | SQLite database (Prisma project root: `packages/db`) |
| `PORT` | `4000` | API port |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed web origin |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000/api` | Browser → API base URL |
| `JWT_SECRET` | (required) | Signing key for API JWTs (≥16 chars) |
| `JWT_EXPIRES_IN` | `12h` | Token lifetime (no server-side revocation yet) |
| `DEFAULT_USER_ID` | `lab-tech-001` | Default **free-text** actor for agent CLI / MCP (not verified against `users`) |
| `AGENT_USE_LLM` | `false` | Set `true` only if using local Ollama |
| `CRON_SCHEDULE` | `0 0 * * *` | Expiration quarantine schedule (host **local** timezone; there is no `LAB_TIMEZONE` yet) |

Seed users (password `changeme123`): `admin` (ADMIN), `lab-tech-001`, `lab-tech-002` (LAB_USER).

Web app also reads `apps/web/.env.local` if present:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

Do **not** commit `.env`, `.env.local`, or `*.db` files.

The web dashboard stores the JWT in browser `localStorage`. MCP and the agent CLI use `DEFAULT_USER_ID` (or a caller-supplied `userId`) and are not JWT-authenticated.

---

## 5. Run the application

### Development (API + Web together)

```bash
npm run dev
```

Then open:

- Dashboard: [http://localhost:3000](http://localhost:3000)  
- API health: [http://localhost:4000/api/health](http://localhost:4000/api/health)

### Run services separately

```bash
npm run dev:api    # Express API on :4000
npm run dev:web    # Next.js on :3000
```

### Agent CLI

```bash
npm run start -w @ml-ims/agent -- "I took 50mL of Lot 902 for Project EXP-101"
```

### MCP server (stdio)

```bash
npm run dev:mcp
```

See [`mcp.json.example`](../mcp.json.example) for Cursor MCP registration.

---

## 6. Verify the install

1. Browser dashboard loads the **login** page; sign in (`lab-tech-001` / `changeme123`).  
2. Dashboard shows reagents. Health endpoint returns `{ "ok": true }` without a token.  
3. Unauthenticated `POST /api/inventory/check-out` returns 401.  
4. Run a sample check-out:

```bash
npm run start -w @ml-ims/agent -- "I took 50mL of Lot 902 for Project EXP-101"
```

5. Refresh the dashboard — Lot `902` quantity decreased; a new transaction appears.  
6. As ADMIN, click **Evaluate thresholds** — Draft POs appear for low-stock reagents (Ampicillin, TSA in seed data).

---

## 7. Optional: PostgreSQL instead of SQLite

SQLite is the default (zero cost, no Docker). PostgreSQL is supported but is **not** yet the migration-first production path, and concurrent check-out is unsafe until an atomic decrement / row lock is implemented ([ROADMAP.md](./ROADMAP.md) Phase 1).

```bash
docker compose up -d
```

1. Edit root `.env` and `packages/db/.env`:

```env
DATABASE_URL="postgresql://mlims:mlims@localhost:5432/mlims?schema=public"
```

2. In `packages/db/prisma/schema.prisma`, set:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

3. Re-apply schema and seed. `db:push` is what `npm run setup` uses. For a named migration history on Postgres prefer:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

`db:push` remains the documented demo path:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

Statuses, units, and roles remain application strings until CHECK/enum work lands. There is no backup/restore runbook yet — copy the SQLite file, or use `pg_dump` / `pg_restore` yourself if you use Postgres.

---

## 8. Windows troubleshooting

### Prisma `EPERM` renaming `query_engine-windows.dll.node`

Another Node process is locking the Prisma engine (often a leftover API server).

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
npm run db:generate
```

Then retry `npm run setup` or `npm run dev`.

### Many red errors in VS Code

1. Confirm the opened folder is `ml-ims`.  
2. Run `npm run setup`.  
3. Command Palette → **TypeScript: Select Workspace Version** → use workspace TypeScript.  
4. **Developer: Reload Window**.

### `npm warn Unknown env config "devdir"`

Harmless environment/npm config warning. It does not mean the project failed.

### Port already in use

Change `PORT` in `.env` (API) or stop the process using `4000` / `3000`.

---

## 9. Useful npm scripts

| Script | Description |
|--------|-------------|
| `npm run setup` | Full first-time setup |
| `npm run env:init` | Copy `.env` templates if missing |
| `npm run dev` | API + web concurrently |
| `npm run db:generate` | Prisma client generate |
| `npm run db:push` | Sync schema to DB (demo / SQLite default) |
| `npm run db:migrate` | Prisma migrate (prefer for PostgreSQL) |
| `npm run db:seed` | Reload demo data |
| `npm run dev:mcp` | Start MCP server |
| `npm run build` | Build all workspaces |

---

## 10. Next steps

- Daily use: [User Guide](./USER_GUIDE.md)  
- Requirements and gaps: [User Requirements](./USER_REQUIREMENTS.md) · [Roadmap](./ROADMAP.md)  
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)  
- Security posture: [SECURITY.md](../SECURITY.md)  
