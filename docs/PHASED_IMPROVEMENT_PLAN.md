# Dentaleus phased improvement plan

**Delivery mode:** direct commits to `main`, as requested; do not create pull requests for this work.  
**Current baseline:** `b73a683b48f69dfac9495dfcd12668452ab58f86` (`fix(clinical): handle clinic loading and reject blank treatment titles`).  
**Verification status (2026-10-18):** frontend/backend GitHub Actions jobs are failing before any steps run (`runner_id: 0`, empty runner name, empty step list). This does not establish a source-code test failure, but it also does not verify builds or tests. No successful local build is available in this environment. Treat all runtime behavior as unverified until checks actually execute.  
**UI constraints:** no Tailwind. Reuse Angular/CDK/Material already installed where appropriate, with Dentaleus-owned tokens and light/dark styling. Avoid new dependencies unless an existing dependency cannot meet a demonstrated requirement.

## Phase 1 — Audit and stabilize (current)

### Inspection findings

- The branch contains Angular 21 SSR frontend code, a separate Fastify 5 backend, Better Auth, PostgreSQL migrations, tenant-scoped API routes, and feature-level unit tests.
- The current working tree is not a finished clinical product. Routes for Today, Clinical, Team, Reports, and Settings use a generic workspace placeholder; the full clinical odontogram, signed notes, treatment plans, financial workflows, public clinic Pages, and persisted team/settings/report flows are still explicitly incomplete.
- The agenda is a day-view implementation. Week/month navigation, appointment resize, breaks/leave/holidays, and multiple working intervals per provider remain outstanding.
- The patient treatment history with FDI tooth/surface links is a first iteration, not a full clinical odontogram or complete medical record. Do not treat these records as a replacement for the odontogram's canonical clinical state.
- Build and test outcomes have not yet been verified successfully. The backend and frontend GitHub Actions checks were queued after the syntax fix at the time of this audit; queued is not passing. CI quota issues were previously reported, so a failed or missing run must not be represented as a passing test.
- `docs/ARCHITECTURE.md` describes a different/incomplete architecture (temporary in-memory odontogram, `src/server/backend`, Prisma target) than the current checked-in `backend/` Fastify/PostgreSQL implementation. Reconcile it before relying on it as the source of truth.
- The frontend workflow was updated to use Bun with `bun install --frozen-lockfile`, matching the committed `bun.lock`. The backend retains its own npm workflow; backend lockfile strategy still needs review.
- The backend treatment route had a malformed `ToothSurface` TypeScript union that prevents compilation. Corrected in commit `1dd983e` on this feature branch. Build/tests still need to run to discover further issues.
- Graphify was requested but this environment has no Graphify workspace selected/available. Repository inspection used the GitHub source tree and files directly instead.

### Phase 1 checklist

- [x] Work on the agreed feature branch and merge PR #2 into `main` after the owner explicitly authorized it.
- [x] Inventory frontend, backend, database migrations, tests, and workflows.
- [x] Identify product gaps and documentation contradictions.
- [x] Fix the confirmed malformed TypeScript type in patient treatment routes.
- [ ] Run frontend build and tests (GitHub Actions failed before any steps were reported; no successful result is available).
- [ ] Run backend typecheck, build, migration tests, and policy/integration tests against PostgreSQL.
- [ ] Inspect authentication, authorization, tenant isolation, mutation audit logging, and cross-tenant foreign keys route by route.
- [x] Reconcile architecture documentation with the actual Fastify/PostgreSQL repository layout.
- [x] Confirm no Tailwind dependency/configuration/import matches remain in the repository search (source scan still belongs in local verification).
- [ ] Record verified results and unresolved blockers before moving to Phase 2.

### Phase 1 exit gate

Do not call Phase 1 complete until frontend and backend checks have successful, reproducible results, all critical compilation/security findings are either fixed or explicitly blocked, and the docs accurately describe the checked-in architecture. If CI quota remains unavailable, use a reproducible local check or clearly record that verification is blocked.

## Phase 2 — UI foundations and design consistency

- Define a small shared set of tokens for surfaces, text, borders, spacing, radius, focus, elevation, status, and motion.
- Establish reusable buttons, form fields, field errors, status labels, empty/loading/error states, dialogs, page headers, and responsive layouts. **Shared button/control tokens and honest workspace states implemented. Existing flows use inline forms, so no unused dialog system was added; owner visual verification remains pending.**
- Audit light and dark theme coverage across every route—not just the agenda.
- Use Angular Material/CDK selectively and restyle it to the Dentaleus visual language; do not introduce a second component system. **No new component library or Tailwind was added.**
- Preserve accessible keyboard interactions, visible focus, reduced motion, and non-drag alternatives.
- Exit gate: visual/interaction review of all existing routes at desktop and mobile widths; no regression in working behavior.

## Phase 3 — Authentication, tenancy, and authorization hardening

- Verify session lifecycle, origin/cookie configuration, route guards, organization/clinic selection, and stale state handling.
- Verify every protected endpoint derives permissions from the authenticated session and validates organization + clinic + patient ownership.
- Verify role policy for read/write operations and audit events for sensitive mutations.
- Add cross-tenant and unauthenticated/forbidden integration tests.
- Exit gate: negative authorization tests pass; no patient data can be accessed across tenants.

## Phase 4 — Patient records and clinical workspace

- Improve patient search/list/detail and make active clinic context obvious.
- Separate demographic data, medical/dental history, clinical notes, appointments, treatment plans, documents, and billing references into understandable areas.
- Define the odontogram as the canonical tooth-level clinical state; keep treatment-history entries linked to the correct patient, tooth/surface, appointment, author, and time.
- Add dated findings and an append-only clinical record/audit model before treating the system as safe for real clinical use.
- Exit gate: a complete test patient journey with persistence, history, permissions, and concurrency behavior verified.

## Phase 5 — Scheduling

- Complete day/week/month views, provider/operatory filters, working intervals, breaks, leave, holidays, and appointment resize.
- Validate drag-and-drop against server conflicts; retain keyboard-accessible reschedule controls.
- Add tests for daylight-saving/time-zone boundaries, overlap, cancellation, completed appointments, and concurrent edits.
- Exit gate: scheduling integration tests pass with PostgreSQL and no client-only conflict assumptions.

## Phase 6 — Treatment plans and continuity of care

- Connect diagnosis, odontogram state, proposed treatment, patient acceptance, appointments, completed procedures, and follow-up tasks.
- Distinguish planned care from completed care and record performer/time for completed procedures.
- Make patient recall status and contact attempts auditable; do not claim automated messaging until a provider integration and delivery status exist.
- Exit gate: tooth-by-tooth treatment journey can be followed and audited from plan through completion and recall.

## Phase 7 — Team, clinic operations, and public Pages

- Implement persisted team/role management, clinic settings, reports, and financial workflow boundaries.
- Integrate invoice creation through X-Facture rather than creating a competing invoice engine.
- Keep public clinic Pages and any optional 3D atlas separate from the authenticated CRM; never expose clinical data publicly.
- Exit gate: role-based operational flows and public/private data separation tested.

## Phase 8 — Production readiness

- Verify backup/restore, migration recovery, observability, error redaction, rate limits, security headers, performance, accessibility, and deployment configuration.
- Complete browser end-to-end testing with synthetic data only.
- Do not use real patient data until security, persistence, backup/restore, and clinical acceptance gates are met.
- Exit gate: explicit release checklist signed off; PR remains unmerged until the user approves.

## Working rules

1. PR #2 has been merged to `main`; continue subsequent work from the current `main` head unless a new feature branch is explicitly requested.
2. Make small, phase-scoped commits and preserve working behavior.
3. Do not add Tailwind, seed fictional production data, or claim tests passed without evidence.
4. Every non-trivial logic change gets a focused test.
5. Stop at each phase exit gate; report what changed, what was verified, and what remains blocked before proceeding.


## Current delivery ledger (2026-10-18)

This ledger supersedes any older branch/PR status above the phased checklists. It records actual implementation boundaries, not a promise that a route or visual placeholder is a finished feature.

### Working flows to preserve

- Authentication, clinic onboarding and clinic-context selection.
- Patient list/detail and demographic edits, including optimistic-concurrency conflict handling.
- Day agenda and appointment operations currently implemented by the existing API.
- Patient recalls and contact/status history.
- Initial treatment-history records with FDI tooth/surface references, status transitions and audit history.
- Cross-clinic stale-state guards and loading/error/empty states added to patient, agenda and recall flows.

### Product modules not yet delivered

- **Today dashboard:** real appointment/recall/patient summaries and actionable exceptions; currently navigation actions only.
- **Clinical chart:** canonical odontogram state, dated findings, signed/append-only notes, treatment planning, consent and clinical audit review. Existing treatment history is not a complete odontogram.
- **Scheduling:** week/month views, provider/resource filters, resize, provider working intervals, breaks, leave and holidays; robust server-side conflict and timezone tests.
- **Team/access:** persisted membership administration and role management UI, with authorization tests for each sensitive operation.
- **Clinic settings:** persisted profile, timezone, opening hours and clinic-level preferences.
- **Reports:** period-defined, permission-scoped calculations from persisted records, with clear empty/error states.
- **Operational readiness:** reproducible frontend/backend install and checks, tenant-isolation tests, migration tests, browser acceptance tests, backup/restore procedure and deployment verification.

### Execution order and acceptance gates

1. **Unblock verification/tooling.** Identify why Actions cannot provision a runner; make dependency installation deterministic (including backend lockfile strategy); establish frontend build/unit tests and backend typecheck/build/integration tests that can actually run. Never mark a check green without a completed run.
2. **Security and data integrity.** Audit every route for authenticated session, role, organization/clinic/patient ownership, safe status transitions, transaction boundaries, audit events and cross-tenant foreign keys. Add negative tests for unauthenticated, forbidden, wrong-clinic and stale-write requests.
3. **Finish patient clinical records.** Define one canonical odontogram data model and migrations; separate tooth condition, findings, plans, treatment history and signed notes. Add immutable authorship/timestamps and audited corrections; test FDI/surface validation and concurrency.
4. **Finish scheduling.** Add timezone-aware provider availability and overlap rules on the server first, then accessible week/month UI, filters, resize and non-drag alternatives. Add tests for daylight-saving boundaries, breaks, leave and conflicts.
5. **Implement team, settings and reports** only against persisted API contracts, with permission checks and tests; no mock metrics or fake members.
6. **Complete Today dashboard and UX.** Use real APIs and explicit loading/error/empty states; audit desktop/mobile, keyboard, focus, reduced motion and light/dark themes.
7. **Release gate.** Run migrations against a clean PostgreSQL database, backend integration/security tests, frontend unit/build checks and browser acceptance tests. Verify deployment routing between Angular SSR and Fastify, then smoke-test authenticated and public boundaries. No production-readiness claim before these gates pass.

### Change log

- `pending verification`: connect the official `ZoliQua/Angular-Advanced-Odontogram` v2.6.0 Angular SVG component to the patient record, persist its state through the clinic-scoped odontogram API, show revision history, and load the package stylesheet. The dependency was already declared; no additional library was added. Build/browser verification remains pending because Actions runners are unavailable.

- `b73a683b48f69dfac9495dfcd12668452ab58f86`: distinguish clinic-context loading from no active clinic; prevent closing the patient form while saving; reject blank treatment titles server-side.
- `7699a543b78316ea525b68dcfad02a2e94a08430`: align Today-page copy with the actions that currently exist.
- `c30d0dd4b05d18390796bf73e09ecc3cf74f6a9c`: restore the missing `PatientRecord` type import used by patient initials.
- `bcb13cbedfcc8dfc53c3db7342985319adccc598`: validate FDI tooth numbers in odontogram plan changes.
- `c25e9d24f521197f5535d9e0ef49ab8b086d3801`: allowlist patient-record roles and deny unknown roles, with a regression test.
- `c984c7aaca7c6233371a258b02c9552f9f0a225e`: persist append-only odontogram snapshots per version in a new migration.
- `c46e803136de4784cdac66a33f1e2019683a89e2`: add a permission-checked odontogram revision-history endpoint.
- `ae70e2a67fc5a2632861ed9f363a657fa6b9a78e`: cover odontogram revision tenant isolation in the PostgreSQL integration test.
