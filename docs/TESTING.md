# Testing Guide

## Framework

- **Vitest** unit/integration tests  
- GitHub Actions workflow: `.github/workflows/ci.yml`

## Run locally

```bash
npm run setup          # once
npm test               # builds packages then runs vitest
npm run test:watch     # interactive
```

## What is covered

| Suite | Path | Focus |
|-------|------|-------|
| Agent parser | `packages/core/src/services/agentService.test.ts` | NL → tool mapping |
| Shared Zod | `packages/shared/src/index.test.ts` | Input validation |
| Inventory | `packages/core/src/services/inventoryService.test.ts` | Check-out, audit, reorder PO, overdraft, duplicate open PO |

Inventory tests spin up a temporary SQLite file and run `prisma db push --force-reset`.

## Manual smoke checklist

1. `npm run dev`  
2. Open http://localhost:3000  
3. Check out 50 from Lot `902` for `EXP-101`  
4. Confirm transaction appears  
5. Evaluate thresholds → Draft POs for low stock  
6. Advance a PO: Draft → Pending Approval → Submitted → Received  
7. Create a supplier / reagent / lot from **Master data admin**  
8. Agent: `I took 50mL of Lot 902 for Project EXP-101`

## CI

On push/PR, CI installs, generates Prisma client, builds packages/apps, and runs `npm test`.
