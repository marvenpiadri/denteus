import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { denyInsufficientRole, requireClinicAccess } from '../auth/authorization.js';
import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';

interface ClinicParams {
  organizationId: string;
  clinicId: string;
}
interface AppointmentParams extends ClinicParams {
  appointmentId: string;
}
interface ScheduleQuery {
  from: string;
  to: string;
}
interface CreateAppointmentBody {
  patientId: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
}
interface RescheduleBody {
  startsAt: string;
  endsAt: string;
}
interface StatusBody {
  status: 'CONFIRMED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
}

const statuses = ['SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
type AppointmentStatus = typeof statuses[number];

const scheduleQuerySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['from', 'to'],
  properties: {
    from: { type: 'string', format: 'date-time' },
    to: { type: 'string', format: 'date-time' },
  },
} as const;

const createAppointmentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['patientId', 'startsAt', 'endsAt'],
  properties: {
    patientId: { type: 'string', minLength: 1, maxLength: 100 },
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
    reason: { type: 'string', maxLength: 300 },
  },
} as const;

const rescheduleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['startsAt', 'endsAt'],
  properties: {
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
  },
} as const;

const statusSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] },
  },
} as const;

const appointmentSelect = `
  a.id,
  a.organization_id AS "organizationId",
  a.clinic_id AS "clinicId",
  a.patient_id AS "patientId",
  p.patient_number AS "patientNumber",
  p.first_name AS "patientFirstName",
  p.last_name AS "patientLastName",
  to_char(a.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "startsAt",
  to_char(a.ends_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "endsAt",
  a.status,
  a.reason,
  a.created_by_id AS "createdById",
  to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
  to_char(a.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"
`;

function canManageAppointments(role: string): boolean {
  return [
    'ORGANIZATION_OWNER',
    'ORGANIZATION_ADMIN',
    'CLINIC_ADMIN',
    'DENTIST',
    'ORTHODONTIST',
    'HYGIENIST',
    'ASSISTANT',
    'RECEPTIONIST',
  ].includes(role);
}

function denyAppointmentRole(reply: FastifyReply): null {
  reply.code(403).send({
    error: { code: 'FORBIDDEN', message: 'Your role does not permit managing appointments.' },
  });
  return null;
}

function validDuration(startsAt: string, endsAt: string): boolean {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const duration = end - start;
  return Number.isFinite(start) && Number.isFinite(end) && duration >= 5 * 60_000 && duration <= 8 * 60 * 60_000;
}

async function lockClinicSchedule(client: PoolClient, organizationId: string, clinicId: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [organizationId, clinicId]);
}

export const appointmentRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: ClinicParams; Querystring: ScheduleQuery }>(
    '/organizations/:organizationId/clinics/:clinicId/appointments',
    { schema: { querystring: scheduleQuerySchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return denyAppointmentRole(reply);

      const from = Date.parse(request.query.from);
      const to = Date.parse(request.query.to);
      if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 31 * 24 * 60 * 60_000) {
        return reply.code(400).send({
          error: { code: 'INVALID_SCHEDULE_RANGE', message: 'Choisissez une période valide de 31 jours maximum.' },
        });
      }

      const result = await pool.query(
        `
          SELECT ${appointmentSelect}
          FROM appointments a
          JOIN patients p
            ON p.organization_id = a.organization_id
           AND p.id = a.patient_id
          WHERE a.organization_id = $1
            AND a.clinic_id = $2
            AND a.starts_at < $4::timestamptz
            AND a.ends_at > $3::timestamptz
          ORDER BY a.starts_at ASC
          LIMIT 500
        `,
        [request.params.organizationId, request.params.clinicId, request.query.from, request.query.to],
      );
      return { data: result.rows, count: result.rows.length };
    },
  );

  app.post<{ Params: ClinicParams; Body: CreateAppointmentBody }>(
    '/organizations/:organizationId/clinics/:clinicId/appointments',
    { schema: { body: createAppointmentSchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return denyAppointmentRole(reply);

      if (!validDuration(request.body.startsAt, request.body.endsAt)) {
        return reply.code(400).send({
          error: { code: 'INVALID_APPOINTMENT_DURATION', message: 'Un rendez-vous doit durer entre 5 minutes et 8 heures.' },
        });
      }

      const patient = await pool.query(
        `
          SELECT 1 FROM patient_clinics
          WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3
          LIMIT 1
        `,
        [request.params.organizationId, request.params.clinicId, request.body.patientId],
      );
      if (!patient.rowCount) {
        return reply.code(404).send({
          error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found in this clinic.' },
        });
      }

      const client = await pool.connect();
      let transactionOpen = false;
      const appointmentId = randomUUID();
      try {
        await client.query('BEGIN');
        transactionOpen = true;
        await lockClinicSchedule(client, request.params.organizationId, request.params.clinicId);

        const overlap = await client.query(
          `
            SELECT 1
            FROM appointments
            WHERE organization_id = $1
              AND clinic_id = $2
              AND status NOT IN ('CANCELLED', 'NO_SHOW')
              AND patient_id = $5
              AND starts_at < $4::timestamptz
              AND ends_at > $3::timestamptz
            LIMIT 1
          `,
          [request.params.organizationId, request.params.clinicId, request.body.startsAt, request.body.endsAt, request.body.patientId],
        );
        if (overlap.rowCount) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return reply.code(409).send({
            error: { code: 'APPOINTMENT_OVERLAP', message: 'Ce créneau chevauche un autre rendez-vous de la clinique.' },
          });
        }

        const result = await client.query(
          `
            INSERT INTO appointments (
              id, organization_id, clinic_id, patient_id, starts_at, ends_at, reason, created_by_id
            )
            VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8)
            RETURNING id
          `,
          [
            appointmentId,
            request.params.organizationId,
            request.params.clinicId,
            request.body.patientId,
            request.body.startsAt,
            request.body.endsAt,
            request.body.reason?.trim() || null,
            access.userId,
          ],
        );

        await client.query(
          `
            INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
            VALUES ($1, $2, $3, 'APPOINTMENT_CREATED', 'APPOINTMENT', $4, $5::jsonb)
          `,
          [
            randomUUID(),
            request.params.organizationId,
            access.userId,
            result.rows[0].id,
            JSON.stringify({
              clinicId: request.params.clinicId,
              patientId: request.body.patientId,
              startsAt: request.body.startsAt,
              endsAt: request.body.endsAt,
            }),
          ],
        );

        await client.query('COMMIT');
        transactionOpen = false;
        const created = await pool.query(
          `
            SELECT ${appointmentSelect}
            FROM appointments a
            JOIN patients p ON p.organization_id = a.organization_id AND p.id = a.patient_id
            WHERE a.organization_id = $1 AND a.clinic_id = $2 AND a.id = $3
          `,
          [request.params.organizationId, request.params.clinicId, appointmentId],
        );
        return reply.code(201).send({ data: created.rows[0] });
      } catch (error) {
        if (transactionOpen) await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  );

  app.patch<{ Params: AppointmentParams; Body: StatusBody }>(
    '/organizations/:organizationId/clinics/:clinicId/appointments/:appointmentId/status',
    { schema: { body: statusSchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return denyAppointmentRole(reply);

      const client = await pool.connect();
      let transactionOpen = false;
      try {
        await client.query('BEGIN');
        transactionOpen = true;
        await lockClinicSchedule(client, request.params.organizationId, request.params.clinicId);
        const current = await client.query<{ status: AppointmentStatus; patientId: string }>(
          `
            SELECT status, patient_id AS "patientId"
            FROM appointments
            WHERE organization_id = $1 AND clinic_id = $2 AND id = $3
            FOR UPDATE
          `,
          [request.params.organizationId, request.params.clinicId, request.params.appointmentId],
        );
        const currentStatus = current.rows[0]?.status;
        if (!currentStatus) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return reply.code(404).send({
            error: { code: 'APPOINTMENT_NOT_FOUND', message: 'Appointment not found.' },
          });
        }

        const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
          SCHEDULED: ['CONFIRMED', 'ARRIVED', 'CANCELLED', 'NO_SHOW'],
          CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
          ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
          IN_PROGRESS: ['COMPLETED'],
          COMPLETED: [],
          CANCELLED: [],
          NO_SHOW: [],
        };
        if (!transitions[currentStatus].includes(request.body.status)) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return reply.code(409).send({
            error: { code: 'INVALID_STATUS_TRANSITION', message: 'Cette transition de statut n’est pas autorisée.' },
          });
        }

        await client.query(
          'UPDATE appointments SET status = $4, updated_at = clock_timestamp() WHERE organization_id = $1 AND clinic_id = $2 AND id = $3',
          [request.params.organizationId, request.params.clinicId, request.params.appointmentId, request.body.status],
        );
        await client.query(
          `
            INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
            VALUES ($1, $2, $3, 'APPOINTMENT_STATUS_CHANGED', 'APPOINTMENT', $4, $5::jsonb)
          `,
          [
            randomUUID(),
            request.params.organizationId,
            access.userId,
            request.params.appointmentId,
            JSON.stringify({ clinicId: request.params.clinicId, from: currentStatus, to: request.body.status }),
          ],
        );
        await client.query('COMMIT');
        transactionOpen = false;
        return { data: { id: request.params.appointmentId, status: request.body.status } };
      } catch (error) {
        if (transactionOpen) await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  );

  app.patch<{ Params: AppointmentParams; Body: RescheduleBody }>(
    '/organizations/:organizationId/clinics/:clinicId/appointments/:appointmentId/reschedule',
    { schema: { body: rescheduleSchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return denyAppointmentRole(reply);
      if (!validDuration(request.body.startsAt, request.body.endsAt)) {
        return reply.code(400).send({
          error: { code: 'INVALID_APPOINTMENT_DURATION', message: 'Un rendez-vous doit durer entre 5 minutes et 8 heures.' },
        });
      }

      const client = await pool.connect();
      let transactionOpen = false;
      try {
        await client.query('BEGIN');
        transactionOpen = true;
        await lockClinicSchedule(client, request.params.organizationId, request.params.clinicId);
        const current = await client.query<{ status: AppointmentStatus; patientId: string }>(
          `
            SELECT status, patient_id AS "patientId"
            FROM appointments
            WHERE organization_id = $1 AND clinic_id = $2 AND id = $3
            FOR UPDATE
          `,
          [request.params.organizationId, request.params.clinicId, request.params.appointmentId],
        );
        const status = current.rows[0]?.status;
        if (!status) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return reply.code(404).send({
            error: { code: 'APPOINTMENT_NOT_FOUND', message: 'Appointment not found.' },
          });
        }
        if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return reply.code(409).send({
            error: { code: 'APPOINTMENT_NOT_RESCHEDULABLE', message: 'Un rendez-vous terminé ou clôturé ne peut pas être déplacé.' },
          });
        }

        const overlap = await client.query(
          `
            SELECT 1 FROM appointments
            WHERE organization_id = $1
              AND clinic_id = $2
              AND patient_id = $5
              AND id <> $6
              AND status NOT IN ('CANCELLED', 'NO_SHOW')
              AND starts_at < $4::timestamptz
              AND ends_at > $3::timestamptz
            LIMIT 1
          `,
          [request.params.organizationId, request.params.clinicId, request.body.startsAt, request.body.endsAt, current.rows[0].patientId, request.params.appointmentId],
        );
        if (overlap.rowCount) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return reply.code(409).send({
            error: { code: 'APPOINTMENT_OVERLAP', message: 'Ce créneau chevauche un autre rendez-vous de la clinique.' },
          });
        }

        await client.query(
          `
            UPDATE appointments
            SET starts_at = $4::timestamptz, ends_at = $5::timestamptz, updated_at = clock_timestamp()
            WHERE organization_id = $1 AND clinic_id = $2 AND id = $3
          `,
          [request.params.organizationId, request.params.clinicId, request.params.appointmentId, request.body.startsAt, request.body.endsAt],
        );
        await client.query(
          `
            INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
            VALUES ($1, $2, $3, 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT', $4, $5::jsonb)
          `,
          [
            randomUUID(),
            request.params.organizationId,
            access.userId,
            request.params.appointmentId,
            JSON.stringify({ clinicId: request.params.clinicId, startsAt: request.body.startsAt, endsAt: request.body.endsAt }),
          ],
        );
        await client.query('COMMIT');
        transactionOpen = false;
        return { data: { id: request.params.appointmentId, startsAt: request.body.startsAt, endsAt: request.body.endsAt } };
      } catch (error) {
        if (transactionOpen) await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  );
};
