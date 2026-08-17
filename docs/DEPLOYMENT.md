# Deployment Guide

## Recommended local / lab server path

1. Install Node.js 20+.  
2. Clone and run setup:

```bash
git clone https://github.com/raorayala/ml-ims.git
cd ml-ims
npm run setup
npm run build
```

3. Start API (compiled) and web:

```bash
npm run start -w @ml-ims/api
npm run start -w @ml-ims/web
```

Or keep using `npm run dev` for development (tsx + Next dev server).

Intended for a **trusted laboratory network**, not an unhardened public internet deployment. See [SECURITY.md](../SECURITY.md) and [ROADMAP.md](./ROADMAP.md) Phase 3.

## Environment

Copy `.env.example` → `.env` (done by `npm run env:init`). Critical vars:

- `DATABASE_URL` — SQLite file or PostgreSQL connection string  
- `PORT` — API port (default 4000)  
- `CORS_ORIGIN` — dashboard origin  
- `NEXT_PUBLIC_API_BASE_URL` — browser API base  
- `JWT_SECRET` — required, ≥16 characters; never use the example value in production  
- `JWT_EXPIRES_IN` — token lifetime (default `12h`); tokens cannot be revoked server-side yet  
- `DEFAULT_USER_ID` — actor string for MCP/CLI only  
- `CRON_SCHEDULE` — expiration job; calendar day is the **API host local timezone** (no `LAB_TIMEZONE`)

## PostgreSQL

```bash
docker compose up -d
```

Set `DATABASE_URL` to `postgresql://mlims:mlims@localhost:5432/mlims?schema=public`, switch Prisma `provider` to `postgresql`, then apply schema and seed.

- Demo: `npm run db:push && npm run db:seed`  
- Preferred once Postgres is first-class: `npm run db:migrate && npm run db:seed`

**Do not run concurrent check-out against PostgreSQL as a production workflow** until Phase 1 (atomic conditional decrement or row lock). Prisma transactions today re-read then write the computed quantity.

Schema statuses and units are strings; invalid values can be inserted with SQL until CHECK/enum constraints exist.

## Docker (API + Web + optional Postgres)

```bash
docker compose -f docker-compose.yml -f docker-compose.app.yml up --build
```

See `docker-compose.app.yml` and Dockerfiles under `apps/api` and `apps/web`. Pin `LAB` host timezone if you rely on expiration midnight (until `LAB_TIMEZONE` is implemented).

## Health probes

- Liveness: `GET /api/health`  
- Readiness: `GET /api/ready` — **`SELECT 1` only**. It does not verify migrations, disk, object storage, or the cron process.

Planned: dependency-aware readiness ([ROADMAP.md](./ROADMAP.md) Phase 5 / NFR-08).

## Backup and restore

There is **no** scheduled backup, restore drill, or auditable export in the product.

| Engine | Practical approach today |
|--------|--------------------------|
| SQLite | Stop writers; copy `packages/db/dev.db` (or your `DATABASE_URL` file) |
| PostgreSQL | `pg_dump` / `pg_restore` (or volume snapshots) |

Test restore on a spare database before you need it. Planned: documented runbooks and drills (FR-61).

## Observability

API request logging and cron `console.log` lines are unstructured. There are no metrics or error-tracking hooks. Planned: structured logs/metrics (FR-62).

## Security notes

- JWT auth is on (except `/api/health`, `/api/ready`, `/api/auth/login`). Bind to localhost or a private lab VLAN.  
- The dashboard keeps JWTs in **localStorage** (XSS can steal them). Prefer not to expose the web UI beyond trusted workstations.  
- MCP/CLI are privileged local tools with caller-supplied `userId`.  
- Do not commit `.env` or database files.  
- Review [SECURITY.md](../SECURITY.md) before any wider exposure.
