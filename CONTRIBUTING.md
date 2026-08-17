# Contributing to ML-IMS

Thanks for helping improve the Microbiology Laboratory Inventory Management System.

## Development setup

1. Fork / clone [raorayala/ml-ims](https://github.com/raorayala/ml-ims).  
2. Use Node.js 20+.  
3. Run `npm run setup`.  
4. Open `ml-ims.code-workspace` in VS Code/Cursor.  
5. Start with `npm run dev`.

## Branching

- Create feature branches from `master` using the `cursor/` prefix when working via Cursor, or a descriptive name (`feat/...`, `fix/...`, `docs/...`).  
- Keep PRs focused. Follow [docs/ROADMAP.md](./docs/ROADMAP.md) order when choosing work: **integrity → PO receiving/traceability → security → operations/reporting → UX scale-up**.

## Checks before opening a PR

```bash
npm run build:packages
npm test
npm run build -w @ml-ims/web
```

`npm test` must be able to write package `dist/` directories.

## Coding guidelines

- Prefer changes in `packages/core` for business logic shared by API/MCP/agent.  
- Validate inputs with Zod schemas in `@ml-ims/shared`.  
- **Stock integrity:** do not add another read-then-write quantity update. New stock changes must be an atomic conditional update (`quantity >= requested`) or a documented row lock / serializable transaction, with parallel tests.  
- **Audit:** every quantity or stock-status change must insert `inventory_transactions` (check-out, check-in, adjustment, disposal, receive). Do not extend `updateLot` to change quantity.  
- **PO status:** do not treat “set any status string” as a receive workflow; receiving must create/update lots and ledger rows.  
- **Reports:** never add a total that sums quantities of different units without an explicit conversion model.  
- **Actors:** HTTP routes bind the session user; do not trust client `userId`. MCP/CLI should move toward a service identity, not a caller-supplied actor.  
- Do not commit `.env`, credentials, or `*.db` files.

## Documentation

Update docs under `docs/` when behavior or setup changes. If you ship a gap-closing feature, update [USER_REQUIREMENTS.md](./docs/USER_REQUIREMENTS.md) implementation notes, [ROADMAP.md](./docs/ROADMAP.md), [API.md](./docs/API.md) / OpenAPI, and [CHANGELOG.md](./CHANGELOG.md). See the README documentation table.

Keep docs honest: do not describe planned behavior (row locks, immutable DB ledger, PO goods receipt, cookie sessions) as if it already shipped.
