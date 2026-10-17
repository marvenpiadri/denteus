# Dentaleus API

This is the independent Node.js backend. It is intentionally separate from Angular SSR and can be deployed as its own service.

## Stack

- Node.js + TypeScript
- Fastify 5
- PostgreSQL via `pg`
- Versioned SQL migrations (no ORM)

## Local development

From this directory:

```sh
npm install
```

Set `DATABASE_URL` in the environment, then run:

```sh
npm run db:migrate
npm run dev
```

The API listens on `http://localhost:4100` by default. `GET /health` checks process health; `GET /health/ready` checks PostgreSQL readiness.

For production, provide secrets through the deployment environment, run migrations as a controlled release step, and configure the frontend's API origin/reverse proxy separately. Do not expose PostgreSQL to the browser.

## Current scope

This initial foundation intentionally exposes health endpoints only. Patient, appointment, odontogram and organization endpoints must not be added until authentication and server-derived organization/clinic membership enforcement are implemented and tested. The existing Express SSR server still contains legacy demo API code during migration; it is not approved for real patient data and must be removed/disabled before production.
