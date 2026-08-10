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

## Environment

Copy `.env.example` → `.env` (done by `npm run env:init`). Critical vars:

- `DATABASE_URL` — SQLite file or PostgreSQL connection string  
- `PORT` — API port (default 4000)  
- `CORS_ORIGIN` — dashboard origin  
- `NEXT_PUBLIC_API_BASE_URL` — browser API base  

## PostgreSQL

```bash
docker compose up -d
```

Set `DATABASE_URL` to `postgresql://mlims:mlims@localhost:5432/mlims?schema=public`, switch Prisma `provider` to `postgresql`, then `npm run db:push && npm run db:seed`.

## Docker (API + Web + optional Postgres)

```bash
docker compose -f docker-compose.yml -f docker-compose.app.yml up --build
```

See `docker-compose.app.yml` and Dockerfiles under `apps/api` and `apps/web`.

## Health probes

- Liveness: `GET /api/health`  
- Readiness: `GET /api/ready` (checks DB)

## Security notes

- No authentication in v1 — bind to localhost or a private lab VLAN.  
- Do not commit `.env` or database files.  
- Review [SECURITY.md](../SECURITY.md) before internet exposure.
