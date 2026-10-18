# Dentaleus phased improvement plan

**Working branch:** `refactor/clinical-product-foundation`  
**Pull request:** [#2 — route-driven clinical workspace](https://github.com/marvenpiadri/denteus/pull/2)  
**Merge status:** PR #2 was merged into `main` at the owner's explicit request. Phase 1 remains open because build/test verification and the full security audit are not complete.  
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
- Establish reusable buttons, form fields, field errors, status labels, empty/loading/error states, dialogs, page headers, and responsive layouts.
- Audit light and dark theme coverage across every route—not just the agenda.
- Use Angular Material/CDK selectively and restyle it to the Dentaleus visual language; do not introduce a second component system.
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
