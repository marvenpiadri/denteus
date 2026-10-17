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
- The 3D dental atlas is optional content inside a public clinic website Page template only. It is not part of the Dentaleus CRM app, navigation, or clinical workflow. Preserve the existing atlas only in that website-template project and load clinic identity/content from website configuration.
- Support an organization with multiple clinics, staff membership and permission scopes from the start.
- Keep hosting/provider-specific domain operations behind an adapter. Do not assume Vercel is the hosting provider.

## Domain and hostname rules

- The canonical platform origin is `https://dentaleus.com`; do not create or advertise a `www` hostname.
- Clinic websites use generated subdomains such as `amina-absc2235.dentaleus.com`.
- Normalize hostnames to lowercase and strip a trailing dot before lookup. Reject malformed labels and reserved platform labels such as `app`, `api`, and `mail`.
- Store hostnames as database records associated with immutable website IDs; never derive tenant identity from a request-supplied organization ID.
- DNS and hosting configuration must route the apex platform hostname and clinic subdomains to the application without coupling application logic to a hosting vendor.

## Current findings

- The old Angular root was a single tab-state prototype with an empty router. The refactor branch now has a route-driven clinical shell and explicit URLs for today's work, agenda, patients, clinical chart, team, reports and settings.
- The new workspace intentionally shows no fictional patients, appointments, user identity or metrics while the authenticated API context is unavailable.
- The disconnected prototype feature components, hardcoded data services, mock tenancy state, and legacy tab-navigation components have been removed from the refactor branch. Clinical screens and domain types will be rebuilt against typed API contracts rather than ported wholesale.
- The CRM global stylesheet no longer imports Tailwind utilities or the odontogram library stylesheet. The 3D atlas and its rendering styles are not part of the CRM application.
- Fastify has Better Auth sessions, session-scoped organization listing, and PostgreSQL-backed patient and odontogram routes scoped to authorized organization/clinic paths. Backend CI has not yet been confirmed green.
- The new frontend CI workflow currently reports failure without useful job-step logs; build/test validation remains unverified. Do not interpret this as a code-level failure or as a passing build until a runnable job provides logs.
- Sign-in and sign-up pages now use Better Auth email/password sessions. A transactional Fastify endpoint creates an organization, first clinic, owner memberships and an audit event; the onboarding UI collects the initial clinic details. The CRM shell loads authorized organizations/clinics and lets the user select an active clinic. The patient list/search/create/detail/edit flow now calls the tenant-scoped PostgreSQL API; patient edits are audited and use optimistic concurrency. API-client tests have been authored but are not verified as passing. Appointment persistence and timezone-aware scheduling, patient detail/edit, and a first persistent recall queue with contact-attempt history are now implemented on the branch. The recall UI is connected to tenant-scoped Fastify/PostgreSQL endpoints; appointment resource scheduling, provider/chair conflict prevention, clinical note/chart workflow, treatment planning, financial workflows, and end-to-end auth/tenant tests remain incomplete. Tests are authored but have not been verified as passing. Do not use real patient data.
- Angular remains on version 21; do not combine an unrequested major framework upgrade with this refactor.
- The 3D dental atlas is not part of the CRM app. It belongs only inside an optional public clinic website Page template.

See [Real-world dental CRM requirements](./REAL_WORLD_DENTAL_CRM_REQUIREMENTS.md) for the product benchmark, sources from the ADA, Dentrix and Open Dental, workflow gaps, and acceptance gates.

## Phases and acceptance gates

### Phase 0 — Audit and product boundary

- Keep the CRM as the authenticated private application.
- Treat the 3D atlas as an optional feature of the public website Page template only; it must not be embedded in or bundled as a CRM feature.
- Define organization, clinic, user membership, Page template, website and domain as separate concepts.
- Freeze the first-customer scope; defer nonessential CRM expansion.

Acceptance: agreed data model and launch checklist; no Dali-specific identity in the reusable template.

### Phase 1 — Independent API, PostgreSQL and authentication foundation

- Keep Angular SSR as the frontend application and establish a separately runnable Fastify + TypeScript API.
- Use PostgreSQL through `pg`; manage schema changes with versioned, transactional SQL migrations. Do not use Prisma or another mandatory ORM.
- Add environment configuration, safe health/readiness endpoints, connection pooling and graceful shutdown.
- Implement Better Auth email/password sessions with PostgreSQL-backed session storage.
- Derive user identity from the server-validated session; never trust user IDs supplied in request bodies or query strings.
- Enforce organization and clinic membership on every private API route using the server-derived session identity.
- Replace demo patient/odontogram storage with PostgreSQL repositories and transactional audit events.
- Remove production dependence on hardcoded demo records.
- Add automated tests for unauthenticated requests, cross-organization and cross-clinic access denial, and restart persistence.

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
- Adapt the public website project into a tenant-configurable Page template.
- Offer the 3D atlas only as an optional block/section on that public Page; never show it inside the CRM.
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
3. Build and run the backend TypeScript checks and apply the SQL migration against a clean PostgreSQL database.
4. Add integration tests for authentication, organization/clinic isolation, patient persistence and odontogram persistence across restarts.
5. Wire the Angular frontend to the new Fastify API and verify the complete clinic workflow before the pilot uses real data.
