# Dentaleus architecture

**Status:** current source-level architecture baseline for `main`. This document describes the checked-in structure and known boundaries; it is not a claim that every clinical module is complete or production-ready.

## Runtime boundaries

```
src/app/        Angular 21 application, routes, feature UI and SSR config
src/server.ts   Angular SSR server entry
backend/        Separate Fastify 5 API service
backend/src/auth/ Better Auth session and tenant authorization
backend/src/routes/ HTTP API route modules
backend/src/domain/ Framework-independent domain policies and tests
backend/src/db/ PostgreSQL pool, SQL migrations and schema tests
```

The Angular SSR server and Fastify API are separate processes. The frontend uses relative `/api` requests through the development proxy; production routing must explicitly route API requests to Fastify and page requests to Angular SSR. Do not assume SSR itself is the clinical API.

The backend currently uses Fastify, Better Auth, `pg`, and hand-written SQL migrations. Prisma is not currently the persistence layer. Do not describe an in-memory odontogram or a `src/server/backend` implementation as the current source of truth.

## Authentication and tenant scope

- Better Auth owns sign-in, sessions, accounts, and verification records.
- API routes resolve the session from request cookies/headers, then check organization and clinic membership server-side through the shared clinic-access helper or an equivalent authenticated flow.
- Patient, appointment, recall, treatment, and odontogram operations should validate that the target record belongs to the active organization and clinic. Source review shows clinic-scoped predicates in representative routes; endpoint-by-endpoint negative authorization tests remain a required owner verification step.
- UI route guards and hidden controls are usability aids, not authorization boundaries.
- Odontogram and treatment writes include audit events; recall changes have recall-specific history. Verify unified audit coverage for all sensitive mutations before production use.

## Clinical data boundaries

The patient record is the central entry point, but different concepts must remain distinct:

- **Patient demographics:** identity and contact details.
- **Clinical odontogram:** canonical tooth-level clinical status and plan state. Avoid maintaining a competing tooth-condition representation in the treatment-history UI.
- **Treatment history:** dated care items with FDI tooth/surface references, status, performer and audit events. The current implementation is an initial workflow, not a complete clinical chart.
- **Clinical notes/findings:** the initial workflow supports dated encounters, signed append-only notes, amendments, findings, procedures, follow-ups, patient clinical history, and private clinical media. Consent workflows, broader clinical acceptance, and validation of the complete record lifecycle remain release concerns.
- **Appointments:** scheduling records linked to a patient and optional provider/operatory resources.
- **Recalls:** follow-up records and contact-attempt history. Automated messaging and delivery receipts are not implemented.
- **Billing:** retain treatment and patient context plus invoice references; use the X-Facture integration boundary rather than building a competing invoice engine.

## Scheduling

Appointments are persisted business records. Availability and rescheduling must consider:

- organization and clinic scope
- patient overlap
- practitioner and operatory assignment
- appointment duration and status
- provider working hours in the clinic's timezone
- future breaks, leave, holidays, and multiple working intervals

The server is authoritative for conflicts. Client drag-and-drop is an interaction only; every move must use the tenant-scoped rescheduling API, reload server state after a conflict, and offer an accessible non-drag alternative.

The calendar engine contains time-grid, month, and year view components, but the separately supplied reusable calendar archive has not yet been transplanted. Treat the shipped view set, resize behavior, drag/drop conflict recovery, keyboard alternatives, and mobile scheduling flow as unverified until the replacement is available and the full calendar is tested.

## Public clinic Pages

Public clinic websites are a separate experience from the authenticated CRM. Public pages may include an optional 3D dental atlas as a template section, but the atlas is not part of CRM navigation and must never expose patient records, appointments, clinical notes, or other private data.

Public booking must use a clinic-scoped public interface and expose only the minimum information required to request an appointment. Availability must be checked again server-side when a request is submitted.

## Persistence and migrations

- PostgreSQL is the current persistence target and is accessed through `pg`.
- SQL files in `backend/src/db/migrations` are the schema source; migration execution is serialized with a PostgreSQL advisory lock and records applied migration names.
- Changes to schema must include forward migrations and relevant integration coverage.
- Backend dependencies are managed independently and no checked-in backend lockfile was found during this source review; make dependency installation reproducible as part of tooling hardening.
- Backup/restore and migration recovery need explicit owner verification.
- Do not use real patient data until authorization, tenant isolation, persistence, backup/restore, and clinical workflow acceptance checks have passed.

## Current feature state

Implemented initial flows include authentication/onboarding, tenant context, patient CRUD, appointment scheduling and resource setup, treatment history linked to FDI teeth/surfaces, patient recalls, odontogram revision protection, signed clinical notes and amendments, dated findings and procedures, follow-ups, private clinical media, patient clinical history, clinic settings, team invitations, and aggregate reports. These are foundations, not proof of production readiness.

Remaining work includes verifying the complete reusable calendar transplant, consent and broader treatment-plan lifecycle, billing, public clinic Pages, automated communications, deployment routing and secrets, reproducible backend dependency installation, backup/restore, and end-to-end acceptance across roles and devices.

See `docs/PHASED_IMPROVEMENT_PLAN.md` for the phased implementation plan, source-audit findings, and owner verification boundary.
