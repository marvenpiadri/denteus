# Dentaleus API

This is the independent Node.js backend. It is intentionally separate from Angular SSR and can be deployed as its own service. The optional 3D dental atlas is not part of this API or the CRM; it belongs only to the public clinic website Page template.

## Stack

- Node.js + TypeScript
- Fastify 5
- Better Auth for email/password sessions
- PostgreSQL via `pg`
- Versioned SQL migrations (no ORM)

## Local development

From this directory:

```sh
npm install
cp .env.example .env
```

Set a local PostgreSQL `DATABASE_URL` and generate a random `BETTER_AUTH_SECRET` of at least 32 characters. Keep `BETTER_AUTH_URL` aligned with the API origin and list only trusted frontend origins in `CLIENT_ORIGINS`.

Then run:

```sh
npm run db:migrate
npm run typecheck
npm run build
npm test
npm run dev
```

The API listens on `http://localhost:4100` by default. The PostgreSQL integration test requires a clean test database with the migration applied; it creates and removes its own fixtures.

- `GET /health` checks process health.
- `GET /health/ready` checks PostgreSQL readiness.
- `/api/auth/*` serves Better Auth endpoints.
- `GET /api/v1/session` returns a minimal current-user/session view or `401`.
- `GET /api/v1/organizations` returns only organizations and clinic scopes associated with the authenticated user's memberships; it never accepts a user ID from the caller.
- Patient list/detail/create routes are nested under an authorized organization and clinic path. Clinical odontogram reads/writes are restricted to explicitly allowed clinical roles.
- Odontogram read/write routes are nested under an authorized organization, clinic and patient path; writes require an allowed clinical role and are audited transactionally.

## Security boundary

The backend now has authenticated organization and clinic-scoped routes for patients, appointments, recalls, scheduling resources, odontograms, clinical encounters, private clinical media, patient clinical history, clinic settings, reports, team management, and organization invitations. Sensitive clinical routes use explicit role policies; clinical writes and invitation changes use transactional persistence and audit events where implemented. These source-level controls do not replace executed negative authorization and integration tests.

Clinical media is stored in PostgreSQL and served only through authenticated clinic-scoped routes. Uploads validate size, category, encoding, and file signatures; downloads verify the stored SHA-256 checksum. Signed clinical records are amended rather than silently overwritten. Database migrations preserve legacy media categories while permitting the current API categories and enforce stored-byte size/checksum consistency.

The Angular SSR server and Fastify API remain separate processes. Do not add private clinical endpoints back to the SSR server or expose PostgreSQL to the browser.

For production, provide secrets through the deployment environment, use HTTPS and exact trusted origins, run migrations as a controlled release step, configure routing from `/api` to Fastify and page requests to Angular SSR, and deploy the frontend and backend independently. The backend currently has no checked-in npm lockfile, so dependency installation is not yet reproducible. Do not use real patient data until the production builds, migration sequence, authorization/persistence tests, backup/restore, and clinical acceptance checks have actually passed.
