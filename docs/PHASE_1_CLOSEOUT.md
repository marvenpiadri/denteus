# Phase 1 closeout — Dentaleus

**Status:** Implementation/source-audit work is complete. The repository owner explicitly owns local build, test, and runtime verification. This closeout does not claim that any build or test passed.

## Completed

- Merged PR #2 to `main`.
- Fixed the malformed `ToothSurface` TypeScript union in the patient-treatment route.
- Reconciled the architecture document with the checked-in Angular SSR + Fastify + Better Auth + PostgreSQL implementation.
- Aligned the frontend workflow's dependency installation with the committed Bun lockfile.
- Reviewed the authentication setup and representative clinic-scoped patient, odontogram, appointment, recall, and treatment route patterns.
- Recorded current feature boundaries and gaps so the initial workflows are not mistaken for a production-complete clinical product.

## Source-audit findings to carry into later phases

1. The odontogram remains flexible JSON and is not yet a validated canonical clinical chart with a complete domain model.
2. Patient treatment history is an initial workflow, not a replacement for the canonical odontogram, signed notes, dated findings, or comprehensive medical/dental history.
3. Scheduling is day-oriented; week/month views, multiple working intervals, breaks, leave, holidays, resize, and complete conflict handling remain incomplete.
4. Representative routes scope queries by organization and clinic and use shared session/membership authorization. Endpoint-by-endpoint negative authorization tests are still required.
5. Odontogram and treatment mutations write audit events; recall changes have recall-specific event history. Unified audit coverage for every sensitive patient and scheduling mutation needs further review.
6. The backend has no checked-in dependency lockfile in the source reviewed; make backend dependency installation reproducible.
7. Generic workspace placeholders remain for Today, Clinical, Team, Reports, and Settings. Public clinic Pages, billing workflow integration, and automated communication delivery remain incomplete.
8. Deployment routing between Angular SSR and Fastify, secrets/origins, backup/restore, monitoring, rate limits, error redaction, and recovery need owner verification.

## Owner verification handoff

- Frontend build and unit tests.
- Backend typecheck/build.
- PostgreSQL migrations and integration tests.
- Full endpoint-by-endpoint authorization and cross-tenant tests.
- Runtime/deployment configuration and backup/restore checks.

GitHub Actions runs previously failed before reporting execution steps. No successful verification result is asserted. Do not use real patient data or claim production readiness until verification and clinical acceptance are complete.

## Next implementation phase

Phase 2 is UI foundations and design consistency: shared tokens, reusable form and feedback components, responsive layouts, complete light/dark coverage, and accessible keyboard/non-drag interactions. Preserve the no-Tailwind constraint and existing working behavior.
