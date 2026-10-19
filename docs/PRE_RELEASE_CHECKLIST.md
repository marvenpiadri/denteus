# Denteus pre-release checklist

This checklist is a release gate, not a claim that the items have passed. Mark an item complete only after recording an actual command result, CI run, deployment inspection, or owner acceptance result.

## Build and dependency integrity

- [ ] Install the frontend from the committed Bun lockfile with `bun install --frozen-lockfile`.
- [ ] Run frontend lint with `npm run lint`.
- [ ] Run the production Angular SSR build with `npm run build`.
- [ ] Run frontend tests with `npm test -- --watch=false`.
- [ ] Commit a backend dependency lockfile and switch backend CI/deployment installation to a frozen install. The backend currently has no checked-in npm lockfile, and its `npm install` can resolve different dependency versions over time.
- [ ] Run the backend production dependency audit with `npm audit --omit=dev --audit-level=high` after dependency installation.
- [ ] Run `npm run typecheck`, `npm run build`, and `npm test` from `backend/`.
- [ ] Run migrations against a clean PostgreSQL 16 database and verify the full migration sequence, including private clinical media, clinic timezone, media category compatibility, media byte-integrity, checksum-format, and storage-source constraints.
- [ ] Run integration tests against PostgreSQL, not a mocked database.
- [ ] Confirm all GitHub Actions jobs have actually executed steps on a runner. A failed job with no runner and an empty step list is not a compiler or test diagnostic.

## Security and data integrity

- [ ] Verify unauthenticated requests are rejected and unauthorized roles cannot read or mutate another organization, clinic, patient, encounter, or file.
- [ ] Verify organization and clinic administrators cannot sign clinical records without an active provider identity.
- [ ] Verify note, encounter, finding, procedure, and history amendments preserve original entries and produce audit events.
- [ ] Verify media category, MIME type, file signature, size, checksum, and clinic scope enforcement, including legacy media records.
- [ ] Verify API and rendered application responses containing user/session data are not cacheable.
- [ ] Verify production auth URLs and trusted origins use canonical HTTPS origins.
- [ ] Verify production auth-origin, authentication-secret, and PostgreSQL URL validation against the new policy tests.
- [ ] Review rate limiting, account recovery, session expiry/revocation, log redaction, and dependency advisories.
- [ ] Verify backup, restore, migration recovery, and retention policies before using real patient data.

## Deployment

- [ ] Choose and record the production hosting target for the Angular SSR frontend and the independent Fastify API.
- [ ] Configure production routing so page requests reach Angular SSR and `/api/*` requests reach Fastify; do not expose PostgreSQL to the browser.
- [ ] Configure `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, and exact `CLIENT_ORIGINS` through the hosting secret manager. Configure `DATABASE_POOL_MAX`, `API_HOST`, `API_PORT`, `LOG_LEVEL`, and `TRUST_PROXY` deliberately for the runtime.
- [ ] Verify PostgreSQL TLS settings for the selected host and confirm database traffic is encrypted and certificates are validated where the provider supports it.
- [ ] Run database migrations as a controlled release step before shifting traffic to code that requires the new schema.
- [ ] Verify `/health` and `/health/ready`, TLS termination, trusted proxy configuration, security headers, logs, alerting, and graceful shutdown in the deployed environment.
- [ ] Confirm deployment rollback and database recovery procedures.

## Final UI acceptance — separate pass

- [ ] Review every authenticated and unauthenticated route on desktop and mobile at realistic viewport sizes.
- [ ] Verify navigation, focus order, accessible names, keyboard operation, visible focus, field errors, loading/empty/error/success states, and permission-denied states.
- [ ] Verify long patient names, large lists, long clinical notes, narrow screens, zoom, and horizontal overflow.
- [ ] Exercise patient and clinic switching during async operations.
- [ ] Verify calendar views, drag/drop and resize behavior, conflict recovery, and a non-drag alternative. The replacement reusable calendar archive must be accessible before its transplant can be verified.
- [ ] Capture the final desktop/mobile review findings and confirm fixes in one bounded verification round.

## Release decision

Do not use real patient data or declare production readiness while builds/tests, tenant-boundary checks, database recovery, deployment routing, or clinical acceptance remain unverified.
