# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |

## Reporting a vulnerability

Please open a **private** GitHub security advisory on [raorayala/ml-ims](https://github.com/raorayala/ml-ims/security), or email the repository owner if advisories are unavailable.

Include:

- Affected version / commit  
- Reproduction steps  
- Impact assessment  

You can expect an acknowledgment within a few days when possible.

## Current security posture (v1.2)

- Designed for trusted laboratory / intranet use.  
- REST endpoints (except `/api/health`, `/api/ready`, `/api/auth/login`) require a **JWT** (`Authorization: Bearer`).  
- Roles: `ADMIN` (master data, POs, users, thresholds) and `LAB_USER` (check-out/in, agent, read views).  
- Inventory transaction `userId` is bound from the authenticated session username (not free-text from the client).  
- Passwords are stored with **bcrypt**; set a strong `JWT_SECRET` in production.  
- Secrets must live in `.env` (never commit).  
- Prefer binding the API to localhost or a private network.  
- MCP / agent CLI still accept an acting `userId` for trusted operators — treat those as privileged local tools.

## Dependency alerts

Monitor GitHub Dependabot on the repository and upgrade Next.js / transitive packages when advisories apply.
