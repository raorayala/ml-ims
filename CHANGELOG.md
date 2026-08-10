# Changelog

All notable changes to ML-IMS are documented in this file.

## [1.1.0] — 2026-08-10

### Added
- Master-data CRUD APIs for suppliers, reagents, and lots
- Dashboard admin forms and purchase-order approval actions
- Vitest suites for agent parsing, Zod validation, and inventory reorder
- GitHub Actions CI workflow
- Architecture, API, OpenAPI, testing, and deployment docs
- CONTRIBUTING, CHANGELOG, MIT LICENSE, project-specific SECURITY policy
- Request logging and `/api/ready` readiness probe
- Optional Dockerfiles + `docker-compose.app.yml` for API/web

### Changed
- Package exports now point at compiled `dist` outputs
- Production `start` scripts use `node dist` (dev still uses `tsx`)

## [1.0.0] — 2026-08-10

### Added
- Initial ML-IMS monorepo: API, web dashboard, MCP server, agent CLI
- Prisma schema, seed data, check-out/in, reorder drafts, reports, expiration cron
- SETUP, USER_GUIDE, and USER_REQUIREMENTS documents
