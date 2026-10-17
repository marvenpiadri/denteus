# Dentaleus API

This is the independent Node.js backend. It is intentionally separate from Angular SSR and can be deployed as its own service.

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
npm run dev
```

The API listens on `http://localhost:4100` by default.

- `GET /health` checks process health.
- `GET /health/ready` checks PostgreSQL readiness.
- `/api/auth/*` serves Better Auth endpoints.
- `GET /api/v1/session` returns a minimal current-user/session view or `401`.

## Security boundary

Authentication is wired, but organization/clinic authorization is not complete yet. No patient, appointment or odontogram endpoints are exposed by this service until every request can derive the user from the server-side session and verify the user's organization and clinic membership.

The old Express-mounted demo API has been removed from Angular SSR. Do not add private clinical endpoints back to the SSR server.

For production, provide secrets through the deployment environment, run migrations as a controlled release step, use HTTPS, configure exact trusted origins, and deploy the frontend and backend independently. Do not expose PostgreSQL to the browser.
