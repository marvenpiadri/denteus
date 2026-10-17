# Dentaleus launch plan — October 2026

## Goal

Prepare Dentaleus for its first real clinic before expanding sales. The first clinic is the pilot customer; the code and data model must be reusable for other clinics from day one.

Target: a realistic, tested first-customer release by October 31, 2026. This is a target, not a guarantee: production launch depends on security, persistence, and clinical workflow acceptance tests passing.

## Product rules

- The clinic's public website is free.
- CRM access is subscription-based. Initial price hypothesis: USD 12–20 per month; do not hard-code pricing in the UI or entitlements.
- A website template is called a **Page** in the product. Internally, templates are versioned so changing a template does not silently break existing clinic websites.
- Every clinic can receive a generated hostname such as `amina-absc2235.dentaleus.com`. The random suffix and full normalized hostname must be generated/validated on the server and protected by a database unique constraint.
- Public website pages must never expose patient records, appointment details, clinical notes, or other private CRM data.
- Preserve the interactive 3D dental education features from `marvenpiadri/dentist-page`; remove the old client identity and load clinic identity/content from website configuration.
- Support an organization with multiple clinics, staff membership and permission scopes from the start.
- Keep hosting/provider-specific domain operations behind an adapter. Do not assume Vercel is the hosting provider.

## Domain and hostname rules

- The canonical platform origin is `https://dentaleus.com`; do not create or advertise a `www` hostname.
- Clinic websites use generated subdomains such as `amina-absc2235.dentaleus.com`.
- Normalize hostnames to lowercase and strip a trailing dot before lookup. Reject malformed labels and reserved platform labels such as `app`, `api`, and `mail`.
- Store hostnames as database records associated with immutable website IDs; never derive tenant identity from a request-supplied organization ID.
- DNS and hosting configuration must route the apex platform hostname and clinic subdomains to the application without coupling application logic to a hosting vendor.

## Current findings

- The CRM UI has useful existing modules for patients, appointments, odontograms, treatment plans, reports, clinic settings and subscriptions.
- The old Express-mounted demo API and its hardcoded/in-memory patient and report endpoints have been removed from the SSR server. The new Fastify service currently exposes health endpoints only.
- Patient, appointment and odontogram API repositories/routes are not yet implemented in Fastify; the frontend must not use real patient data until authentication, tenant authorization and persistence are ready.
- Tenant state in `TenantService` is initialized with hardcoded organizations, clinics and users.
- `src/app/app.routes.ts` is currently empty; the shell uses tab state rather than actual feature routes.
- Both `denteus` and `dentist-page` currently declare Angular 21 packages. Confirm the desired Angular target before changing framework versions.
- The current odontogram integration correctly treats the Advanced Odontogram payload as the clinical chart source of truth. Preserve that boundary.

## Phases and acceptance gates

### Phase 0 — Audit and product boundary

- Keep the CRM as the authenticated private application.
- Treat the 3D dental site as a reusable, server-rendered public website experience.
- Define organization, clinic, user membership, Page template, website and domain as separate concepts.
- Freeze the first-customer scope; defer nonessential CRM expansion.

Acceptance: agreed data model and launch checklist; no Dali-specific identity in the reusable template.

### Phase 1 — Independent API, PostgreSQL and authentication foundation

- Keep Angular SSR as the frontend application and establish a separately runnable Fastify + TypeScript API.
- Use PostgreSQL through `pg`; manage schema changes with versioned, transactional SQL migrations. Do not use Prisma or another mandatory ORM.
- Add environment configuration, safe health/readiness endpoints, connection pooling and graceful shutdown.
- Implement authentication and server-derived user identity.
- Enforce organization and clinic membership on every private API route.
- Replace demo patient/odontogram storage with database repositories.
- Remove production dependence on hardcoded demo records.
- Add automated tests for cross-organization and cross-clinic access denial.

Acceptance: data survives restart; unauthenticated private API requests are rejected; a user from Organization A cannot read or change Organization B's patients or odontograms; the API can be deployed independently of Angular SSR.

### Phase 2 — First-clinic onboarding and CRM persistence

- Create organization, first clinic, owner membership and initial subscription transactionally.
- Persist staff and clinic membership.
- Persist patients, appointments and odontogram state.
- Add audit events for sensitive writes.
- Keep the clinical chart payload versioned and owned by the Advanced Odontogram integration.

Acceptance: the pilot clinic can use core workflows without demo-only state.

### Phase 3 — Page templates and clinic websites

- Build a versioned Page template registry and per-website content/theme/SEO configuration.
- Adapt the existing 3D dental website into a tenant-configurable template.
- Preserve interactive 3D dental content by default.
- Generate public-safe clinic, practitioner, service and contact pages.
- Generate canonical URLs, metadata, sitemap and robots directives per published website.

Acceptance: two clinics can use the same Page template with different branding/content and no identity/data leakage.

### Phase 4 — Hostnames and SSR resolution

- Generate readable name + random suffix hostnames on the backend.
- Normalize hostname values and enforce a database unique constraint.
- Resolve incoming hostname to an active website record during SSR.
- Unknown, suspended or unpublished hostnames must not fall back to another tenant's website.
- Keep custom domains as a later provider-adapter phase.

Acceptance: two clinics with identical names can publish distinct URLs; unknown hostnames return a safe not-found response.

### Phase 5 — Subscriptions and commercial gates

- Store plans, price, currency, trial and entitlement rules in the database.
- Public clinic website remains free.
- CRM API and CRM screens enforce server-side subscription entitlements.
- Billing provider integration can be added without coupling core business logic to one provider.

Acceptance: changing a plan updates server-enforced entitlements; hiding a UI button is never the only access control.

### Phase 6 — Ratings, SEO and release quality

- Reviews start pending and are published only after moderation/verification policy.
- Display only genuine reviews and accurate rating aggregates; never fabricate ratings or structured review markup.
- Add backups/restore rehearsal, error monitoring, rate limits, security headers and data export/cancellation procedures.
- Validate mobile UX, SSR metadata, accessibility and performance.

Acceptance: public SEO pages contain only public-safe, accurate information; private clinical information is never indexed.

## Explicitly out of the first release

- Full drag-and-drop website builder.
- Custom-domain self-service and provider-specific DNS automation.
- Complex multi-branch billing and enterprise permissions beyond the data model needed for multiple locations.
- AI-generated clinical decisions.
- Any promise of Google ranking or guaranteed search traffic.

## Immediate next implementation steps

1. Complete the standalone Fastify backend foundation and run its TypeScript checks.
2. Review and test the initial SQL migration against a real PostgreSQL instance.
3. Implement authentication and server-derived organization/clinic permissions before exposing patient endpoints.
4. Add secure Fastify patient and odontogram endpoints and configure the frontend API origin only after authentication and tenant authorization are in place.
5. Add integration tests for persistence, authentication and tenant isolation before the pilot uses real data.
