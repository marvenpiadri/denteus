# Denteus architecture

## Clinical source of truth

The Advanced Odontogram is the only source of truth for tooth-level clinical state and tooth-level treatment intent.

```
Patient
  -> Advanced Odontogram
      -> Status
      -> Plan
      -> Plan changes
      -> Periodontal chart
```

Denteus does not maintain a second tooth-condition representation.

## Business workflow

```
Diagnosis
  -> Odontogram Status
  -> Odontogram Plan
  -> Treatment Plan
  -> Appointment
  -> Procedure completed
  -> Invoice
  -> Payment
```

The odontogram owns clinical semantics. Denteus owns pricing, scheduling, acceptance, completion workflow, billing references, documents, audit and tenancy.

## Current repository boundary

```
src/app/       Angular application and UI
src/server/    temporary HTTP adapter
src/server/backend/
               framework-neutral domain/persistence modules
```

The backend is intentionally inside this Angular repository for now. It can later move to a standalone Node/Fastify service without moving the Angular application into an `apps/web` monorepo.

## Persistence

The current odontogram store is in-memory and temporary.

Production target:

```
Angular
  -> HTTP API
  -> Node/Fastify
  -> Prisma
  -> PostgreSQL
```

The exact versioned odontogram Status/Plan payload should be retained as JSONB, with relational Denteus metadata around it.

## Patient workspace

The patient workspace is being split into focused components:

- patient header
- workspace navigation
- odontogram
- periodontal history
- treatment planning
- clinical notes
- documents
- billing

The goal is to make each component understandable without requiring knowledge of the whole application.

## Scheduling

Appointments are business records. Availability must consider:

- clinic
- practitioner
- chair
- duration
- working window
- existing active appointments

The scheduling domain service is framework-independent and can later move to the Node backend.

## Invoicing

Denteus will not become a second invoice engine.

Future billing boundary:

```
Denteus
  -> X-Facture API
  -> invoice/document engine
```

Denteus retains the patient/treatment context and invoice references while X-Facture owns invoice generation and document infrastructure.

## Public booking

Future public booking is clinic-scoped and patient-facing:

```
QR code
  -> public booking URL
  -> clinic
  -> service/practitioner
  -> available slot
  -> patient contact
  -> appointment request
```

No clinical record is exposed through the public booking surface.

## Implementation phases

1. Clinical core and odontogram
2. Patient workspace decomposition
3. Scheduling and chair availability
4. Public booking and QR
5. Treatment plan workflow
6. Treatment-to-appointment workflow
7. Procedure completion and clinical updates
8. X-Facture API integration
9. Communications and reminders
10. Documents and imaging
11. Laboratory workflow
12. Reporting and operational intelligence
13. Authentication, PostgreSQL, Prisma and production tenant isolation
