# Dentaleus: real-world dental practice workflow requirements

This document is a product and engineering checklist, not a claim of regulatory compliance or clinical validation. Dentaleus is a new product; no prototype/demo data or old routes should be reintroduced to fill gaps.

## Research basis

Reviewed on 2026-10-17:

- American Dental Association, [Documentation / Patient Records](https://www.ada.org/resources/practice/practice-management/documentation-patient-records): records typically include patient identity/contact details, medical and dental histories, progress/treatment notes, proposed treatment and alternatives, diagnostic records, medications, radiographs/photos, consent/refusal, referrals, missed appointments, follow-up and patient communications. Entries should be attributable to the person making them. Clinical and financial records should be kept conceptually separate.
- American Dental Association, [What and How to Write, or Change, in the Dental Record](https://www.ada.org/resources/practice/practice-management/writing-in-the-dental-record): use consistent, objective records; identify the author; preserve timing and history of corrections; do not silently overwrite or backdate clinical documentation.
- Dentrix, [Clinical Features](https://www.dentrixenterprise.com/products/public-health/features/clinical-features) and [Multi-location Features](https://www.dentrixenterprise.com/products/multi-location/features/clinical-features): chart current and prior oral conditions, keep dated history, support periodontal charting, clinical notes, treatment planning and continuing care/recall.
- Dentrix Enterprise, [Practice Administration](https://www.dentrixenterprise.com/products/multi-location/features/practice-administration): multi-location appointment books, provider/site scheduling, detailed transaction logs, centralized recall and billing, and a patient record accessible according to practice structure.
- Open Dental, [Appointments Module](https://www.opendental.com/site/0_appointments.html): day/week scheduling, provider/operatory views, confirmations, waiting room, recall, unscheduled/cancelled/missed appointments, planned appointment tracking and ASAP/wait lists.
- Open Dental, [Appointment Lists](https://www.opendental.com/site/0_appointmentlists.html): recall, confirmation, planned-but-unscheduled, cancelled/no-show follow-up and ASAP lists are separate operational queues.
- Open Dental, [Treatment Plan Module](https://www.opendental.com/site/0_treatmentplan.html): save and prioritize plans, support patient approval/signature, print/share plans, manage plan status and procedure estimates.
- Open Dental, [Recall List](https://www.opendental.com/site/0_recalllist.html): recall is a due-date workflow with contact status, contact details, filters and repeat reminders, not merely a date field on the patient.
- Open Dental, [Planned Appointments](https://www.opendental.com/site/0_plannedappts.html): treatment can be planned before a date is booked; preserve the intent so cancelled or rescheduled appointments do not erase unfinished care.

These sources describe established product patterns, mainly from the US market. They do not establish legal requirements for Morocco. Before production use in Morocco, validate applicable local health-data, professional, retention, consent and patient-access rules with qualified local advisers.

## Workflow principles

1. **One patient identity, scoped clinic access.** A patient can be associated with multiple clinics within an organization. Every query and mutation must be scoped to the authenticated user's organization and active clinic; the server, not the client, decides access.
2. **Schedule around actual resources.** A usable dental schedule eventually needs provider availability, operatories/chairs, appointment duration, breaks/working hours, confirmation, arrival/waiting-room state, rescheduling, cancellation/no-show follow-up, planned treatment, and conflict checks. Patient-only overlap checks are not enough to prevent double-booking a dentist or chair.
3. **Clinical records are attributable and historically safe.** Separate administrative patient details from medical/dental history, clinical notes, chart findings, diagnostic attachments, consent/refusal, and financial records. Signed notes should not be silently edited; corrections need author, timestamp and amendment history.
4. **Treatment is a workflow, not a single odontogram JSON blob.** Keep dated chart findings and planned/completed procedures distinguishable; support a treatment plan with priorities, patient discussion, consent/acceptance/refusal, planned appointments, and completion records. Do not infer diagnoses or prescribe treatment automatically.
5. **Recall and follow-up are queues.** Track recall type, due date, last completed visit, contact attempts, contact status, appointment scheduling, cancellation/no-show follow-up, and patient preference for earlier openings. Avoid claiming a reminder was sent unless an integration confirms delivery.
6. **Roles follow least privilege.** A receptionist can manage the schedule and administrative demographics but should not automatically have access to every clinical action. Separate clinical-note signing, chart modification, financial operations, staff administration and organization ownership.
7. **Audit consequential actions.** Record who created/changed appointments, patient records, clinical notes, chart entries, treatment plans, consents, permissions and exports. Do not put unnecessary sensitive content into audit metadata.
8. **No misleading metrics.** Dashboards should show real persisted values, with definitions and time ranges. No fabricated appointment counts, revenue, completion rates or clinic identities.
9. **Accessible, recoverable forms.** Explicit labels, keyboard access, useful validation, preserved input on recoverable errors, confirmation for destructive/terminal actions and clear success/failure states.
10. **Public pages are a separate trust boundary.** Clinic pages may publish only deliberately approved public information. No patient names, appointments, clinical records, or identifiable clinical imagery should leak to public routes. The 3D dental atlas belongs only to a public clinic Page template, never the CRM workspace.

## Current implementation status

- [x] Tenant-scoped patient list, create, detail and update API foundations.
- [x] Server-enforced organization/clinic authorization foundations and composite tenant foreign keys.
- [x] Persistent appointment create/list/status/reschedule endpoints and audit events.
- [x] Appointment UI with clinic-local timezone conversion, patient conflict checks, explicit cancellation/no-show confirmation and error handling.
- [x] Custom no-dependency day calendar with timezone-aware display, quick-create slots, and provider/operatory resource-column views.
- [x] Clinic-scoped provider and operatory records, explicit weekly provider hours, resource assignment, and server-side conflict checks for assigned appointments.
- [ ] Week/month views, drag/resize, keyboard-equivalent move controls, breaks, leave, holidays, and split shifts.
- [ ] Patient medical/dental history, allergies/medication reconciliation and review dates.
- [ ] Append-only signed clinical notes, correction/amendment trail and encounter association.
- [ ] Versioned chart findings, periodontal charting, attachments/imaging metadata and chart history.
- [ ] Structured treatment plans/procedures, consent/acceptance/refusal and planned appointments.
- [x] Initial recall/continuing-care queue with due dates, status filters, contact attempt history and audit events. Automated messaging, recall rules derived from completed procedures, patient preferences and delivery receipts remain incomplete.
- [x] Patient treatment history with FDI tooth/surface links, attributed completion records, and status-transition events.
- [ ] Complete interactive clinical odontogram, dated findings, clinical notes and linked treatment-plan workflows.
- [ ] Patient appointment history, waiting room, confirmation queue, unscheduled follow-up and ASAP/wait list.
- [ ] Separate financial ledger, estimates, invoices, payments and reconciliation.
- [ ] Staff invitation/provisioning, role matrix and clinic-level permissions.
- [ ] Reports derived from real data; exports and patient-record access workflow.
- [ ] HTTP integration tests for authentication, tenant isolation, permission boundaries, concurrent scheduling and audit history. PostgreSQL integration coverage now includes recall/event persistence, resource assignments, tooth-specific treatment persistence and cross-clinic FK rejection, but has not been executed in this environment.
- [ ] Public clinic Page template with an explicit public-data allowlist; 3D atlas only in that public template.

## Acceptance gates

A phase is not done just because a route or screen exists. It needs schema constraints/migrations, server-side authorization, realistic empty/loading/error states, meaningful tests, and UI behavior connected to persisted API data. Do not import prototype/demo records. Do not use real patient information until tenant isolation, auth, backups, migration recovery and access auditing have been verified.
