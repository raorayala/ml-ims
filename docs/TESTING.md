# Testing Guide

## Framework

- **Vitest** unit/integration tests  
- GitHub Actions workflow: `.github/workflows/ci.yml`

`npm test` builds workspace packages (writes `dist/`) then runs Vitest. A read-only checkout that cannot write `dist/` will fail that compile step; that is an environment limitation, not a product test failure.

## Run locally

```bash
npm run setup          # once
npm test               # builds packages then runs vitest
npm run test:watch     # interactive
```

## What is covered today

| Suite | Path | Focus |
|-------|------|-------|
| Agent parser | `packages/core/src/services/agentService.test.ts` | NL → tool mapping |
| Shared Zod | `packages/shared/src/index.test.ts` | Input validation |
| Inventory | `packages/core/src/services/inventoryService.test.ts` | Sequential check-out, audit insert, reorder PO, overdraft, duplicate open PO |

Inventory tests spin up a temporary SQLite file and run `prisma db push --force-reset`. They do **not** run two overlapping check-outs, do not use PostgreSQL, and do not call the HTTP API.

## Coverage gaps (add with the matching roadmap phase)

See [ROADMAP.md](./ROADMAP.md) §7 and [USER_REQUIREMENTS.md](./USER_REQUIREMENTS.md) FR-33+.

| Missing suite | Why it matters |
|---------------|----------------|
| Parallel check-out / check-in (SQLite + PostgreSQL) | Read-then-write can over-withdraw (G-01) |
| Adjustment/disposal vs `updateLot` | Admin quantity edits skip the ledger (G-02) |
| API authn/authz matrix | JWT and `requireAdmin` are untested at HTTP layer |
| PO transition + receive | Status PATCH is unconstrained; receive does not exist (G-03) |
| Expiry + `LAB_TIMEZONE` | Cron uses host local midnight (G-13) |
| Database CHECK/enum | Invalid status/unit can be stored via SQL (G-05) |
| Browser/component tests | Dashboard admin is create-only; scanner is autofill |
| Login rate limit / session revoke | Not implemented (G-11) |

## Manual smoke checklist

1. `npm run setup` && `npm run dev`  
2. Open http://localhost:3000 and sign in (`lab-tech-001` / `changeme123`)  
3. Check out 50 from Lot `902` for `EXP-101`  
4. Confirm transaction appears  
5. Evaluate thresholds → Draft POs for low stock (ADMIN)  
6. Advance a PO: Draft → Pending Approval → Submitted → Received (**stock will not increase**)  
7. Create a supplier / reagent / lot from **Master data admin**  
8. Agent: `I took 50mL of Lot 902 for Project EXP-101`  
9. `GET /api/health` and `GET /api/ready` without a token  
10. Call `POST /api/inventory/check-out` without `Authorization` → 401  

Optional (integrity): open two terminals and check out the same lot at once on PostgreSQL; document lost updates until Phase 1.

## CI

On push/PR, CI copies `.env.example`, generates Prisma client, `db:push`, builds packages/apps, and runs `npm test`.
