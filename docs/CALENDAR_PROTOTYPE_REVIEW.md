# Calendar prototype review: Gemini and Claude

**Scope:** UX and workflow ideas for Dentaleus' authenticated clinic agenda. This is an engineering review, not clinical validation.

## Gemini sample: `marvenpiadri/dentist-calendar-example`

Reviewed repository: https://github.com/marvenpiadri/dentist-calendar-example

### Strong ideas to preserve

- Resource-first scheduling: side-by-side provider and operatory lanes, working-hours shading, patient identity and status directly on appointment cards.
- Multiple planning perspectives: day, week, month, agenda/list, provider and operatory views are described in the implementation plan.
- Quick-create from a selected time slot and open an existing appointment to edit it.
- Dental-specific patient context: FDI tooth numbers, medical alerts, procedure categories, and patient-specific treatment history.
- Clear visual separation between schedule navigation, resource filters, event details and patient directory.

### What must not be copied as production behavior

- The calendar state service initializes providers, operatories, patients and appointments from hardcoded demo arrays. Appointment events are created by `createInitialAppointments()`; that is prototype state, not a clinic's persisted schedule.
- The reviewed backend route tree contains patient and odontogram APIs but no appointment CRUD route. The calendar's visual interactions therefore must not be assumed to persist through the backend or survive a reload.
- The Angular project uses Tailwind and contains Express-related dependencies, while Dentaleus' refactor uses deliberate CSS and a Fastify/PostgreSQL backend. Port concepts and workflows, not its dependency stack.
- The plan describes recurrence, booking portal, drag/resize, collision resolution and keyboard shortcuts; each capability must be verified in working code before being treated as implemented.
- Generated sample patients, provider identities, external avatar URLs and US-style sample data are not real clinic data and must never be used to seed production records.

## Claude sample

Shared conversation supplied by the product owner:
https://claude.ai/share/4169e27c-45b7-404d-a327-4abba8420c28

The shared conversation did not render in the available review environment, so its artifact/code and UI could not be inspected. No honest feature-by-feature winner can be declared without seeing the Claude result. The comparison should be completed from a directly accessible artifact URL, screenshots, or the exported HTML/Angular source.

## Current Dentaleus direction

- Keep the clinic-local day view and resource columns for practitioners and operatories. The agenda page, standalone calendar component, appointment API, and scheduling-resource API remain separate so the calendar can be reused without owning persistence.
- Persist every appointment through Fastify/PostgreSQL, with tenant-scoped authorization and server-side conflict checks.
- Store provider working hours explicitly; do not invent a default schedule or imply availability if hours are missing.
- Keep patient treatment history linked to FDI teeth and surfaces, with attributed records and status-transition history.
- Do not import the Gemini sample's static clients, appointment seeds, theme storage as data persistence, Tailwind classes, or unrelated stack dependencies. Tailwind and its PostCSS plugin have been removed from the Denteus frontend dependencies/configuration; styling uses explicit CSS tokens and component styles. A clinic-shell theme switch applies light/dark palette overrides to the agenda and calendar.
- The agenda now supports CDK drag-and-drop to move appointments in 15-minute increments and reassign them between practitioner/operatory lanes. The drop calls the tenant-scoped rescheduling API; the server remains authoritative for conflict validation and the UI reloads after success or failure. Terminal appointments cannot be dragged, and the existing edit flow remains available as a keyboard-friendly alternative. Dragging is not yet resize.
- Remaining scheduling work includes resize, week/month views, breaks/leave/holidays, multiple daily working intervals, stronger integration tests and end-to-end verification. The drag-drop unit test has been added but has not been run in this environment.
