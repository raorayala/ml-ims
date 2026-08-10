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
- Keep PRs focused.

## Checks before opening a PR

```bash
npm run build:packages
npm test
npm run build -w @ml-ims/web
```

## Coding guidelines

- Prefer changes in `packages/core` for business logic shared by API/MCP/agent.  
- Validate inputs with Zod schemas in `@ml-ims/shared`.  
- Keep inventory mutations transactional and append-only for the audit ledger.  
- Do not commit `.env`, credentials, or `*.db` files.

## Documentation

Update docs under `docs/` when behavior or setup changes. See README documentation table.
