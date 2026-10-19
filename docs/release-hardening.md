# Denteus release hardening and operations

## Automated release gates

The `.github/workflows/release-hardening.yml` workflow runs on pushes and pull requests targeting `main`. It is intended to gate release readiness on:

- the Angular production build, frontend lint, and frontend unit tests;
- backend typecheck and build;
- applying all SQL migrations to a fresh PostgreSQL 17 database;
- backend unit and PostgreSQL integration tests against that migrated database.

A commit is not considered verified until the workflow's actual run is green. A missing or pending check is not a pass.

## Runtime requirements

- Node.js `22.12.x` (both application packages declare this range).
- PostgreSQL with all numbered migrations applied before serving traffic.
- Separate runtime processes for the Angular SSR frontend and Fastify API.
- The frontend's `/api` development proxy points to `http://127.0.0.1:4100`; production routing must direct API requests to the Fastify service.

## Required production configuration

Configure these values through the deployment platform's secret/environment settings, never in source control:

- `DATABASE_URL`: PostgreSQL connection URL for the API.
- `BETTER_AUTH_URL`: canonical HTTPS origin for the API authentication service, without a trailing slash, path, query, or fragment.
- `BETTER_AUTH_SECRET`: unique, randomly generated secret with at least 32 characters; never reuse the example value.
- `CLIENT_ORIGINS`: comma-separated, canonical HTTPS origins for the trusted browser application(s), without trailing slashes.
- `NODE_ENV=production`.
- `API_HOST`, `API_PORT`, `DATABASE_POOL_MAX`, `LOG_LEVEL`, and `TRUST_PROXY` set deliberately for the runtime topology. Enable `TRUST_PROXY=true` only when requests can reach the service exclusively through a trusted reverse proxy.

The API rejects untrusted or missing Origin headers on state-changing `/api/v1` requests. Keep the frontend origin list exact; do not use wildcards. Authentication endpoints have their own Better Auth origin checks and rate limits.

## Migration and rollback sequence

1. Confirm a recoverable database backup and a tested restore procedure.
2. Review the pending SQL migrations against the production database version and current schema.
3. Apply migrations using `npm run backend:migrate` from the repository root (or `npm run db:migrate` in `backend/`) before deploying code that depends on them.
4. Run `GET /health` and `GET /health/ready`; readiness must report a connected database.
5. Verify sign-in, clinic isolation, appointment scheduling, patient records, clinical media authorization, and audit events using a non-production test tenant.
6. If a release fails, roll back application code only when the schema change is backward-compatible. Database migrations are not automatically reversed; use a reviewed forward fix or a tested restore plan.

## Operational boundaries and outstanding checks

- No production deployment is triggered by this workflow.
- A Vercel project connection was not available during this pass, so provider-specific production routing, environment values, protection settings, and deployment health were not inspected or changed.
- The repository contains a root `bun.lock`, but no backend `package-lock.json` or backend Bun lockfile was found. The current CI installs backend dependencies with `npm install`; create and commit a backend lockfile before treating dependency resolution as fully reproducible.
- Verify backups, restore drills, monitoring/alerting, log retention, TLS termination, database encryption-at-rest, and least-privilege database credentials in the actual hosting environment before production release.
