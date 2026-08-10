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

## Current security posture (v1)

- Designed for trusted laboratory / intranet use.  
- REST mutating endpoints are **not authenticated**.  
- `userId` is a free-text audit field, not an identity provider subject.  
- Secrets must live in `.env` (never commit).  
- Prefer binding the API to localhost or a private network.  
- Add authentication/authorization before any internet exposure.

## Dependency alerts

Monitor GitHub Dependabot on the repository and upgrade Next.js / transitive packages when advisories apply.
