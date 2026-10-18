# Phase 2 — UI foundations and design consistency

**Status:** Phase 2 implementation is complete on `main`; owner build/browser verification remains pending by request.  
**Direction:** a product-grade clinical workspace, not a dashboard concept. Replace the old visual execution rather than preserve it. Retain only proven behavior and domain conventions. Keep Dentaleus recognizable through a restrained clinical teal accent, but redesign layout, hierarchy, density, typography, navigation, component states, and responsive behavior.

## Implementation progress

- [x] Added a documented Phase 2 scope and exit criteria.
- [x] Added shared semantic tokens for surfaces, text, borders, focus, radii, elevation, actions, and light/dark status colors.
- [x] Rebuilt the authenticated shell with clearer navigation groups, custom inline icons, active clinic context, account controls, and a responsive mobile drawer.
- [x] Removed concept-style “reconstruction” notice and “validation before pilot” banner from the main workspace.
- [x] Added system dark-mode preference as the initial theme when the user has not saved a preference; explicit choice remains persisted.
- [x] Migrated shared colors in patient list/detail, agenda, recalls, authentication, onboarding, and workspace styles toward semantic tokens.
- [x] Added theme-aware semantic status colors for success, information, warning, danger, neutral, and accepted treatment states.
- [x] Replaced the Today placeholder with honest, useful links into persisted agenda, patient, and recall workflows without fabricated metrics.
- [x] Replaced generic future-step placeholder copy on unfinished modules with a clear unavailable state and links to existing workflows.
- [x] Removed obsolete route-level “next step” copy and kept existing business logic/API contracts intact.
- [x] Centralized primary/secondary button primitives and shared control sizing/radius tokens.
- [x] Replaced remaining clinical status colors with semantic tokens for success, information, warning, danger, neutral, and accepted treatment states.
- [x] Removed duplicate status overrides where semantic theme tokens now own the values.
- [x] Updated sign-in/sign-up, clinic onboarding, patient forms/details, agenda, recalls, and workspace styles to use shared surface, text, border, focus, and action tokens.
- [x] Applied the saved/system theme before rendering all routes, including sign-in, sign-up, and onboarding.
- [x] Made the mobile navigation drawer inert while closed, dynamically labeled, and closable with Escape.
- [ ] Owner visual review at desktop/tablet/mobile widths and build/test execution. No verification result is claimed in this document.

## Tooling note

Graphify was requested but no Graphify workspace is configured for this agent, so graph-based dependency tracing was unavailable. Source relationships were inspected through repository files. This is a tooling limitation, not a claim that Graphify findings were produced.

## Non-negotiables

- No Tailwind or utility-framework dependency.
- No fictional patient data or fabricated business metrics.
- Do not change API contracts, clinical workflows, authorization, or persisted data merely to achieve visual polish.
- Build on Angular's existing component structure and existing dependencies; avoid a parallel component library.
- Accessibility is behavior: focus visibility, labels, keyboard access, reduced motion, status announcements, and non-drag alternatives.
- A screen that is not implemented must be clearly marked as unavailable/incomplete, not dressed up as if it were functional.

## Work sequence

1. Establish global tokens for surfaces, text, borders, spacing, radii, elevation, focus, status, and typography, with coherent light/dark values.
2. Redesign the authenticated application shell: navigation hierarchy, clinic context, workspace header, account controls, mobile drawer, and content canvas.
3. Normalize shared primitives used by existing features: buttons, inputs, labels, field errors, notices, status badges, panels, page headers, empty/loading/error states, and table/list rows. Existing flows use inline forms rather than dialogs, so no unused dialog abstraction was added.
4. Apply token-driven styling to patient list/detail, agenda, recalls, sign-in/sign-up, and clinic onboarding. Preserve existing templates and interactions while removing duplicated, hard-coded styling.
5. Make incomplete workspace routes honest and useful: explain the missing capability, avoid concept copy, and provide safe navigation to implemented workflows.
6. Add consistent light/dark handling and responsive breakpoints. Prefer system theme only as an initial default; preserve an explicit user choice.
7. Record feature-level UX changes and remaining gaps. **Implementation closeout is complete; only owner-run build/test and visual verification remain.**

## Exit criteria

- The shell and existing functional routes share a coherent design system.
- Light/dark themes cover shell, forms, lists, calendar, errors, and empty states through semantic tokens without feature-level hard-coded status palettes.
- Desktop, tablet, and narrow mobile layouts have deliberate navigation and content behavior.
- Focus, form labels/errors, disabled/loading states, and reduced motion are covered.
- No Tailwind is introduced; no fake data or unconnected controls are added.
- Owner retains responsibility for running builds, tests, and browser verification.
