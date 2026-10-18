# Dentaleus clinical product refactor

**Status:** Shell, auth/onboarding, patient admin, initial resource-aware agenda, tooth-specific treatment history and first recall workflow are implemented on the refactor branch; clinical chart and production acceptance gates remain open  
**Branch:** `refactor/clinical-product-foundation`  
**Product boundary:** authenticated CRM and public clinic Pages are separate experiences. The optional 3D dental atlas belongs only in a public clinic Page template; it is never a CRM feature.

## Current scheduling and treatment-history increment (2026-10-18)

- Added clinic-scoped providers, operatories and explicit provider working hours, with agenda UI to configure them and day-calendar columns by provider or chair.
- Appointment create/reschedule validates patient overlaps plus provider working hours and provider/operatory overlaps server-side when resources are assigned. Unassigned appointments remain possible through the API for future queue workflows; the current UI asks for both resources once the clinic has configured resources.
- Added patient treatment records with FDI tooth and surface links, planned/accepted/completed/declined states, performer attribution for completed care, and append-only status events. Patient detail now includes a tooth selector and treatment timeline. This is an initial treatment-history workflow, not a complete clinical odontogram or complete medical record.
- Added a prototype review documenting the concrete strengths and production gaps in `dentist-calendar-example`. The Claude shared chat could not be rendered in the review environment; no unsupported comparison is claimed.
- Tests were added for treatment policy and PostgreSQL integration coverage was extended, but the build and tests remain unverified in this environment.

## Why this reset exists

The pre-refactor Angular app behaved like a clickable prototype: navigation was primarily tab state, the router had no feature routes, the tenant service seeded fictional organizations and clinics, and several modules were designed around demo state. These are not a safe foundation for a clinical system. We will not preserve the mockup's routing or its assumptions merely to avoid rewriting them.

This is a phased replacement, not a cosmetic redesign. Existing UI can be inspected for useful domain ideas, but no component, route, seed record, or interaction is automatically considered correct because it already exists.

## Product principles

1. **Clinical workflow first.** The default workspace should help a real dental team answer: who is arriving, who needs attention, what must happen next, and where is the relevant patient record? Do not prioritize decorative analytics over the work queue.
2. **One patient identity, explicit clinic context.** Patient identity, clinic scope, appointment, treatment plan, and clinical chart must be understandable and consistent. Always show the active clinic when it affects an action.
3. **No pretend persistence.** A successful save means the API confirmed a durable write. Distinguish loading, saved, unsaved, offline, conflict, and failure states. Never silently fall back to fictional data.
4. **Safe defaults for clinical information.** Minimize unnecessary exposure of sensitive data; use server-side authorization for every protected operation; audit sensitive changes. A hidden button is not an authorization boundary.
5. **Design for interruption.** Dental teams switch between patients, phone calls, rooms, and appointments. Preserve safe draft state where appropriate, make destructive actions deliberate, and provide recoverable errors.
6. **Readable under pressure.** Use a restrained visual hierarchy, legible typography, clear labels, consistent spacing, high contrast, visible focus, keyboard access, and non-colour-only status cues. Avoid tiny text, ambiguous icon-only actions, and dense dashboard cards without decisions attached.
7. **French-first, localization-ready.** Support French and Arabic/RTL without making layout direction a patch applied at the last moment. Dates, phone numbers, currency, and time zones must be explicit and localized.
8. **Public Pages are a separate trust boundary.** Public websites may expose only intentionally published clinic/practitioner/service/contact content. No patient, appointment, treatment, billing, audit, or internal staff data. The 3D atlas may appear only in the public Page template.
9. **Evidence over taste.** Base design choices on recognized accessibility and service-design guidance, task analysis, clinician observation, usability testing, and measurable outcomes. Do not call a design clinically validated until representative dental professionals have tested it.

## Architecture decisions

- Keep Angular 21 until a deliberate, separately tested upgrade is approved.
- Use Angular Router with real feature routes and route-level layouts; remove tab-state navigation as the source of truth.
- Keep the Angular SSR/frontend separate from the Fastify API.
- Use PostgreSQL through `pg` and versioned SQL migrations; no Prisma or mandatory ORM.
- Use Better Auth sessions; derive identity only from the validated server session.
- Model organization membership and clinic membership separately. Every private query must be tenant-scoped server-side.
- Use typed API clients and explicit loading/error/empty states. Do not inject demo objects into production services.
- Keep feature boundaries clear: shell/navigation, dashboard/work queue, patients, agenda, clinical chart/treatment planning, team/permissions, reports, clinic configuration, subscription, and public Page publishing.
- Keep the 3D atlas outside the CRM bundle and navigation. It is optional content owned by the public Page template.

## Phases and acceptance gates

### Phase 0 — Reset and audit (current)
- Establish this product boundary and evidence-based design rules.
- Inventory the existing routes, components, services, seed data, state stores, styles, and SSR behavior.
- Identify all mock data and all controls that currently look functional without persistence.
- Record a replacement map: keep, rewrite, or delete. No legacy route is grandfathered in.

**Gate:** architecture and route map reviewed; no new features are added on top of the mockup shell.

### Phase 1 — App shell and navigation rebuilt
- Replace the empty router plus tab-state navigation with named, deep-linkable routes.
- Separate public landing/clinic Page routes from authenticated CRM routes.
- Add authentication/authorization route guards as UX helpers, while keeping authorization authoritative on the API.
- Create a consistent clinical shell with clinic switcher/context, primary navigation, page title, and responsive behavior.
- Add accessible not-found, forbidden, session-expired, loading, and service-unavailable states.

**Gate:** direct navigation, refresh, back/forward, and unauthorized access behave correctly; no route relies on hidden component state to identify the current page.

### Phase 2 — Real identity and tenant onboarding
- Remove fictional organizations, clinics, users, staff, and subscriptions from runtime services.
- Build sign-in, session restore, sign-out, first organization/clinic creation, owner membership, and clinic selection against Fastify.
- Establish explicit permissions and a server-derived active clinic context.
- Add API integration tests for unauthenticated requests and cross-organization/cross-clinic denial.

**Gate:** a new owner can register and create a clinic without seed data; a second tenant cannot see the first tenant's records.

### Phase 3 — Patient records and clinical chart
- Rebuild patient list/search/detail around server-persisted data and clinic scope.
- Define a safe patient creation/edit workflow with validation and clear confirmation.
- Integrate the existing odontogram engine only as the CRM's clinical chart interface, with documented payload versioning and role policy.
- Add save state, conflict handling, audit history, and clinical data access tests.

**Gate:** records persist across server restarts; clinical chart reads/writes are authorization-tested; no synthetic patient records appear in production.

### Phase 4 — Agenda and chair-side workflow
- Added a PostgreSQL appointments table with tenant/clinic/patient foreign keys, a constrained status set, positive-duration check, and schedule indexes.
- Added tenant-scoped API endpoints to list a bounded date range, create appointments, reschedule, and advance status through explicit transitions. Writes are audited.
- Creation/rescheduling serialize schedule writes per clinic and prevent the same patient from being booked in overlapping appointments. Parallel appointments for different patients remain allowed because rooms/chairs and provider assignment have not yet been modeled.
- Added pure unit tests for duration bounds, role access, and status transitions; they are authored but not verified as passing.
- Added a clinic-timezone-aware agenda UI with create, reschedule, explicit status transitions, patient links, loading/error states and cancellation/no-show confirmation.
- Added an initial recall/continuing-care queue with due dates, status filters, persisted contact-attempt history, status transitions and tenant-scoped API endpoints.
- Remaining: provider availability and room/chair resource conflict rules, richer appointment confirmation/waiting-room/planned-treatment queues, recall automation and scheduled-appointment linkage, API/database integration tests, and usability validation.

**Gate:** appointment workflows are durable, auditable, timezone-correct, and tested for patient/resource collisions and tenant isolation. This gate is not yet verified.

### Phase 5 — Treatment plans, reports, staff and settings
- Persist treatment plans, staff memberships, clinic hours, rooms/chairs, and settings.
- Reports derive from persisted, authorized data and clearly state the date range and definitions.
- Enforce roles and subscription entitlements server-side.

**Gate:** no dashboard/report numbers are hardcoded; users see only the data and actions their role permits.

### Phase 6 — Public clinic Pages
- Build versioned, tenant-configurable public Page templates and publish workflows.
- Resolve clinic websites from normalized, unique hostnames on the server.
- Keep public content allow-listed and separate from CRM repositories/API permissions.
- Offer the 3D atlas only as an optional public Page section.

**Gate:** two clinics can publish distinct websites; unpublished/unknown hostnames fail closed; public pages never return private clinical fields.

### Phase 7 — Quality, accessibility and pilot readiness
- Add unit, API integration, database integration, and end-to-end tests.
- Target WCAG 2.2 AA, including keyboard operation, visible focus, labels, error summaries, contrast, zoom/reflow, and screen-reader semantics.
- Run moderated task-based usability tests with dentists, assistants, and reception staff; measure task completion, errors, time, and recovery from interruption.
- Rehearse backups/restores, logging/monitoring, migration rollback strategy, incident response, export, and account closure.

**Gate:** clinical users complete representative workflows without critical usability or safety failures; CI is green; migration and restore have been exercised. Until then, no real patient data.

## First implementation sequence

1. Add and execute API/database tests for auth, tenant denial, durable patient/appointment/recall writes, audit events, and optimistic concurrency.
2. Extend the agenda to real provider/operatory schedules and prevent provider/chair double-booking; add confirmation, waiting-room, unscheduled and ASAP workflows.
3. Rebuild the clinical chart UI against a versioned, dated clinical-record contract, including history and safe correction semantics.
4. Implement structured treatment plans, procedure tracking, consent/acceptance/refusal, and planned appointments linked to scheduling.
5. Add medical/dental history, allergies/medication reconciliation, imaging metadata and append-only signed clinical notes.
6. Keep the PR in draft until a local build/test run or a usable CI run verifies the code.

## Research basis

This is product and engineering guidance, not a claim of clinical validation. The standards below inform accessibility and service UX; dental-specific workflows must still be validated with practicing clinicians. The detailed dental product benchmark is maintained in [REAL_WORLD_DENTAL_CRM_REQUIREMENTS.md](./REAL_WORLD_DENTAL_CRM_REQUIREMENTS.md).

- NHS Service Manual, accessibility design guidance (WCAG 2.2, clear labels, error handling, do not rely on colour alone): https://service-manual.nhs.uk/accessibility/design
- NHS Service Manual, error messages (explain what went wrong and how to fix it; preserve entered data): https://service-manual.nhs.uk/design-system/components/error-message
- NHS Service Standard, inclusive services and user research with people who have access needs: https://service-manual.nhs.uk/standards-and-technology/service-standard-points/5-make-sure-everyone-can-use-the-service
- NHS Service Manual, accessible testing (automated and manual testing; consistent navigation and keyboard/screen-reader patterns): https://service-manual.nhs.uk/accessibility/testing

## Non-negotiable constraints

- No legacy routing or tab-state routing as the long-term architecture.
- No fake patient, appointment, report, clinic, or user data in production paths.
- No untested cross-tenant access assumptions.
- No public exposure of private clinical data.
- No 3D dental atlas inside the CRM.
- No claim of production readiness until the acceptance gates are met.
