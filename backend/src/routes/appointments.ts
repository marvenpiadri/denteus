import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { requireClinicAccess } from '../auth/authorization.js';
import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import { canManageAppointments, canTransitionAppointmentStatus, isValidAppointmentDuration, isValidScheduleRange } from '../domain/appointment-policy.js';
import type { AppointmentStatus } from '../domain/appointment-policy.js';

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
  providerId?: string | null;
  operatoryId?: string | null;
}
interface RescheduleBody {
  startsAt: string;
  endsAt: string;
  providerId?: string | null;
  operatoryId?: string | null;
  patientId?: string;
  reason?: string | null;
}
interface StatusBody {
  status: 'SCHEDULED' | 'CONFIRMED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
}

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
    providerId: { anyOf: [{ type: 'string', minLength: 1, maxLength: 100 }, { type: 'null' }] },
    operatoryId: { anyOf: [{ type: 'string', minLength: 1, maxLength: 100 }, { type: 'null' }] },
  },
} as const;

const rescheduleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['startsAt', 'endsAt'],
  properties: {
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
    providerId: { anyOf: [{ type: 'string', minLength: 1, maxLength: 100 }, { type: 'null' }] },
    operatoryId: { anyOf: [{ type: 'string', minLength: 1, maxLength: 100 }, { type: 'null' }] },
    patientId: { type: 'string', minLength: 1, maxLength: 100 },
    reason: { anyOf: [{ type: 'string', maxLength: 300 }, { type: 'null' }] },
  },
} as const;

const statusSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] },
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
  a.provider_id AS "providerId",
  pr.display_name AS "providerName",
  a.operatory_id AS "operatoryId",
  op.name AS "operatoryName",
  a.created_by_id AS "createdById",
  to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
  to_char(a.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"
`;

function denyAppointmentRole(reply: FastifyReply): null {
  reply.code(403).send({
    error: { code: 'FORBIDDEN', message: 'Your role does not permit managing appointments.' },
  });
  return null;
}

async function lockClinicSchedule(client: PoolClient, organizationId: string, clinicId: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [organizationId, clinicId]);
}

export const appointmentRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { organizationId: string; clinicId: string; patientId: string } }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/appointments',
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return denyAppointmentRole(reply);
      const patient = await pool.query(
        'SELECT 1 FROM patient_clinics WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3',
        [request.params.organizationId, request.params.clinicId, request.params.patientId],
      );
      if (!patient.rowCount) return reply.code(404).send({ error: { code: 'PATIENT_NOT_FOUND', message: 'Patient introuvable dans cette clinique.' } });
      const result = await pool.query(
        `SELECT ${appointmentSelect}
         FROM appointments a
         JOIN patients p ON p.organization_id = a.organization_id AND p.id = a.patient_id
         LEFT JOIN clinic_providers pr ON pr.organization_id = a.organization_id AND pr.clinic_id = a.clinic_id AND pr.id = a.provider_id
         LEFT JOIN clinic_operatories op ON op.organization_id = a.organization_id AND op.clinic_id = a.clinic_id AND op.id = a.operatory_id
         WHERE a.organization_id = $1 AND a.clinic_id = $2 AND a.patient_id = $3
         ORDER BY a.starts_at DESC
         LIMIT 100`,
        [request.params.organizationId, request.params.clinicId, request.params.patientId],
      );
      return { data: result.rows, count: result.rows.length };
    },
  );

  app.get<{ Params: ClinicParams; Querystring: ScheduleQuery }>(
    '/organizations/:organizationId/clinics/:clinicId/appointments',
    { schema: { querystring: scheduleQuerySchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return denyAppointmentRole(reply);

      if (!isValidScheduleRange(request.query.from, request.query.to)) {
        return reply.code(400).send({
          error: { code: 'INVALID_SCHEDULE_RANGE', message: 'Choisissez une période valide d’un an maximum.' },
        });
      }

      const result = await pool.query(
        `
          SELECT ${appointmentSelect}
          FROM appointments a
          JOIN patients p
            ON p.organization_id = a.organization_id
           AND p.id = a.patient_id
          LEFT JOIN clinic_providers pr
            ON pr.organization_id = a.organization_id AND pr.clinic_id = a.clinic_id AND pr.id = a.provider_id
          LEFT JOIN clinic_operatories op
            ON op.organization_id = a.organization_id AND op.clinic_id = a.clinic_id AND op.id = a.operatory_id
          WHERE a.organization_id = $1
            AND a.clinic_id = $2
            AND a.starts_at < $4::timestamptz
            AND a.ends_at > $3::timestamptz
          ORDER BY a.starts_at ASC
          LIMIT 5000
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

      if (!isValidAppointmentDuration(request.body.startsAt, request.body.endsAt)) {
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

        if ((request.body.providerId && !request.body.operatoryId) || (!request.body.providerId && request.body.operatoryId)) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return reply.code(400).send({
            error: { code: 'RESOURCE_ASSIGNMENT_REQUIRED', message: 'Choisissez à la fois un praticien et un fauteuil, ou laissez les deux champs vides.' },
          });
        }

        if (request.body.providerId && request.body.operatoryId) {
          const availability = await client.query(
            `SELECT
               EXISTS (
                 SELECT 1 FROM clinic_providers p
                 JOIN clinics c ON c.organization_id = p.organization_id AND c.id = p.clinic_id
                 JOIN provider_working_hours h
                   ON h.organization_id = p.organization_id AND h.clinic_id = p.clinic_id
                  AND h.provider_id = p.id
                  AND h.day_of_week = EXTRACT(DOW FROM ($3::timestamptz AT TIME ZONE c.timezone))::int
                 WHERE p.organization_id = $1 AND p.clinic_id = $2 AND p.id = $5 AND p.active
                   AND ($3::timestamptz AT TIME ZONE c.timezone)::date = ($4::timestamptz AT TIME ZONE c.timezone)::date
                   AND ($3::timestamptz AT TIME ZONE c.timezone)::time >= h.starts_at
                   AND ($4::timestamptz AT TIME ZONE c.timezone)::time <= h.ends_at
               ) AS provider_available,
               EXISTS (
                 SELECT 1 FROM clinic_operatories o
                 WHERE o.organization_id = $1 AND o.clinic_id = $2 AND o.id = $6 AND o.active
               ) AS operatory_available,
               EXISTS (
                 SELECT 1 FROM appointments a
                 WHERE a.organization_id = $1 AND a.clinic_id = $2
                   AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
                   AND a.provider_id = $5
                   AND a.starts_at < $4::timestamptz AND a.ends_at > $3::timestamptz
               ) AS provider_conflict,
               EXISTS (
                 SELECT 1 FROM appointments a
                 WHERE a.organization_id = $1 AND a.clinic_id = $2
                   AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
                   AND a.operatory_id = $6
                   AND a.starts_at < $4::timestamptz AND a.ends_at > $3::timestamptz
               ) AS operatory_conflict`,
            [request.params.organizationId, request.params.clinicId, request.body.startsAt, request.body.endsAt,
              request.body.providerId, request.body.operatoryId],
          );
          const available = availability.rows[0];
          if (!available.provider_available) {
            await client.query('ROLLBACK'); transactionOpen = false;
            return reply.code(409).send({ error: { code: 'PROVIDER_UNAVAILABLE', message: 'Le praticien n’a pas d’horaires configurés pour ce créneau ou ne travaille pas à cette heure.' } });
          }
          if (!available.operatory_available) {
            await client.query('ROLLBACK'); transactionOpen = false;
            return reply.code(409).send({ error: { code: 'OPERATORY_UNAVAILABLE', message: 'Le fauteuil sélectionné n’est pas disponible dans cette clinique.' } });
          }
          if (available.provider_conflict) {
            await client.query('ROLLBACK'); transactionOpen = false;
            return reply.code(409).send({ error: { code: 'PROVIDER_CONFLICT', message: 'Ce praticien a déjà un rendez-vous sur ce créneau.' } });
          }
          if (available.operatory_conflict) {
            await client.query('ROLLBACK'); transactionOpen = false;
            return reply.code(409).send({ error: { code: 'OPERATORY_CONFLICT', message: 'Ce fauteuil a déjà un rendez-vous sur ce créneau.' } });
          }
        }

        const result = await client.query(
          `
            INSERT INTO appointments (
              id, organization_id, clinic_id, patient_id, starts_at, ends_at, reason, created_by_id, provider_id, operatory_id
            )
            VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8, $9, $10)
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
            request.body.providerId ?? null,
            request.body.operatoryId ?? null,
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
              providerId: request.body.providerId ?? null,
              operatoryId: request.body.operatoryId ?? null,
            }),
          ],
        );

        const created = await client.query(
          `
            SELECT ${appointmentSelect}
            FROM appointments a
            JOIN patients p ON p.organization_id = a.organization_id AND p.id = a.patient_id
            LEFT JOIN clinic_providers pr
            ON pr.organization_id = a.organization_id AND pr.clinic_id = a.clinic_id AND pr.id = a.provider_id
          LEFT JOIN clinic_operatories op
            ON op.organization_id = a.organization_id AND op.clinic_id = a.clinic_id AND op.id = a.operatory_id
            WHERE a.organization_id = $1 AND a.clinic_id = $2 AND a.id = $3
          `,
          [request.params.organizationId, request.params.clinicId, appointmentId],
        );
        await client.query('COMMIT');
        transactionOpen = false;
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
        const current = await client.query<{ status: AppointmentStatus; patientId: string; startsAt: string; endsAt: string; providerId: string | null; operatoryId: string | null }>(
          `
            SELECT status, patient_id AS "patientId",
                   starts_at AS "startsAt", ends_at AS "endsAt",
                   provider_id AS "providerId", operatory_id AS "operatoryId"
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

        if (!canTransitionAppointmentStatus(currentStatus, request.body.status)) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return reply.code(409).send({
            error: { code: 'INVALID_STATUS_TRANSITION', message: 'Cette transition de statut n’est pas autorisée.' },
          });
        }

        if (request.body.status === 'NO_SHOW') {
          const ended = await client.query<{ ended: boolean }>(
            'SELECT ends_at <= now() AS ended FROM appointments WHERE organization_id = $1 AND clinic_id = $2 AND id = $3',
            [request.params.organizationId, request.params.clinicId, request.params.appointmentId],
          );
          if (!ended.rows[0]?.ended) {
            await client.query('ROLLBACK');
            transactionOpen = false;
            return reply.code(409).send({
              error: { code: 'APPOINTMENT_NOT_ENDED', message: 'Un rendez-vous ne peut être marqué comme absent qu’après l’heure prévue de fin.' },
            });
          }
        }

        if (request.body.status === 'ARRIVED') {
          const appointmentDay = await client.query<{ isToday: boolean }>(
            `SELECT (a.starts_at AT TIME ZONE c.timezone)::date = (now() AT TIME ZONE c.timezone)::date AS "isToday"
             FROM appointments a JOIN clinics c
               ON c.organization_id = a.organization_id AND c.id = a.clinic_id
             WHERE a.organization_id = $1 AND a.clinic_id = $2 AND a.id = $3`,
            [request.params.organizationId, request.params.clinicId, request.params.appointmentId],
          );
          if (!appointmentDay.rows[0]?.isToday) {
            await client.query('ROLLBACK');
            transactionOpen = false;
            return reply.code(409).send({
              error: { code: 'APPOINTMENT_NOT_TODAY', message: 'Un patient ne peut être marqué comme arrivé que le jour du rendez-vous.' },
            });
          }
        }

        if (request.body.status === 'SCHEDULED') {
          const conflicts = await client.query<{ conflict: boolean }>(
            `SELECT (
               EXISTS (SELECT 1 FROM appointments a WHERE a.organization_id = $1 AND a.clinic_id = $2
                 AND a.id <> $3 AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
                 AND a.patient_id = current.patient_id
                 AND a.starts_at < current.ends_at AND a.ends_at > current.starts_at)
               OR EXISTS (SELECT 1 FROM appointments a WHERE a.organization_id = $1 AND a.clinic_id = $2
                 AND a.id <> $3 AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
                 AND a.provider_id = current.provider_id AND current.provider_id IS NOT NULL
                 AND a.starts_at < current.ends_at AND a.ends_at > current.starts_at)
               OR EXISTS (SELECT 1 FROM appointments a WHERE a.organization_id = $1 AND a.clinic_id = $2
                 AND a.id <> $3 AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
                 AND a.operatory_id = current.operatory_id AND current.operatory_id IS NOT NULL
                 AND a.starts_at < current.ends_at AND a.ends_at > current.starts_at)
             ) AS conflict
             FROM appointments current
             WHERE current.organization_id = $1 AND current.clinic_id = $2 AND current.id = $3`,
            [request.params.organizationId, request.params.clinicId, request.params.appointmentId],
          );
          if (conflicts.rows[0]?.conflict) {
            await client.query('ROLLBACK');
            transactionOpen = false;
            return reply.code(409).send({
              error: { code: 'APPOINTMENT_REINSTATEMENT_CONFLICT', message: 'Le créneau n’est plus disponible. Vérifiez le patient, le praticien et le fauteuil avant de rétablir ce rendez-vous.' },
            });
          }

          const { startsAt, endsAt, providerId, operatoryId } = current.rows[0];
          if ((providerId && !operatoryId) || (!providerId && operatoryId)) {
            await client.query('ROLLBACK');
            transactionOpen = false;
            return reply.code(409).send({
              error: { code: 'APPOINTMENT_RESOURCES_INVALID', message: 'Les ressources associées à ce rendez-vous ne sont plus valides. Réattribuez le praticien et le fauteuil avant de le rétablir.' },
            });
          }
          if (providerId && operatoryId) {
            const availability = await client.query(
              `SELECT
                 EXISTS (
                   SELECT 1 FROM clinic_providers p
                   JOIN clinics c ON c.organization_id = p.organization_id AND c.id = p.clinic_id
                   JOIN provider_working_hours h ON h.organization_id = p.organization_id
                     AND h.clinic_id = p.clinic_id AND h.provider_id = p.id
                     AND h.day_of_week = EXTRACT(DOW FROM ($3::timestamptz AT TIME ZONE c.timezone))::int
                   WHERE p.organization_id = $1 AND p.clinic_id = $2 AND p.id = $5 AND p.active
                     AND ($3::timestamptz AT TIME ZONE c.timezone)::date = ($4::timestamptz AT TIME ZONE c.timezone)::date
                     AND ($3::timestamptz AT TIME ZONE c.timezone)::time >= h.starts_at
                     AND ($4::timestamptz AT TIME ZONE c.timezone)::time <= h.ends_at
                 ) AS provider_available,
                 EXISTS (SELECT 1 FROM clinic_operatories o
                   WHERE o.organization_id = $1 AND o.clinic_id = $2 AND o.id = $6 AND o.active) AS operatory_available`,
              [request.params.organizationId, request.params.clinicId, startsAt, endsAt, providerId, operatoryId],
            );
            if (!availability.rows[0]?.provider_available || !availability.rows[0]?.operatory_available) {
              await client.query('ROLLBACK');
              transactionOpen = false;
              return reply.code(409).send({
                error: { code: 'APPOINTMENT_RESOURCES_UNAVAILABLE', message: 'Le praticien ou le fauteuil est inactif, ou les horaires du praticien ne couvrent plus ce rendez-vous.' },
              });
            }
          }
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
      if (!isValidAppointmentDuration(request.body.startsAt, request.body.endsAt)) {
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
        const currentAppointment = current.rows[0];
        const status = currentAppointment?.status;
        if (!currentAppointment || !status) {
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

        const patientId = request.body.patientId ?? currentAppointment.patientId;
        if (patientId !== currentAppointment.patientId && ['ARRIVED', 'IN_PROGRESS'].includes(status)) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return reply.code(409).send({ error: { code: 'PATIENT_CHANGE_NOT_ALLOWED', message: 'Le patient ne peut plus être changé après son arrivée ou le début du soin.' } });
        }
        if (patientId !== currentAppointment.patientId) {
          const patient = await client.query(
            `SELECT 1 FROM patient_clinics WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3 LIMIT 1`,
            [request.params.organizationId, request.params.clinicId, patientId],
          );
          if (!patient.rowCount) {
            await client.query('ROLLBACK');
            transactionOpen = false;
            return reply.code(404).send({ error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found in this clinic.' } });
          }
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
          [request.params.organizationId, request.params.clinicId, request.body.startsAt, request.body.endsAt, patientId, request.params.appointmentId],
        );
        if (overlap.rowCount) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return reply.code(409).send({
            error: { code: 'APPOINTMENT_OVERLAP', message: 'Ce créneau chevauche un autre rendez-vous de la clinique.' },
          });
        }

        const assigned = await client.query<{ providerId: string | null; operatoryId: string | null }>(
          'SELECT provider_id AS "providerId", operatory_id AS "operatoryId" FROM appointments WHERE organization_id = $1 AND clinic_id = $2 AND id = $3',
          [request.params.organizationId, request.params.clinicId, request.params.appointmentId],
        );
        const resource = assigned.rows[0];
        const providerId = request.body.providerId !== undefined ? request.body.providerId : resource?.providerId ?? null;
        const operatoryId = request.body.operatoryId !== undefined ? request.body.operatoryId : resource?.operatoryId ?? null;
        if ((providerId && !operatoryId) || (!providerId && operatoryId)) {
          await client.query('ROLLBACK'); transactionOpen = false;
          return reply.code(400).send({ error: { code: 'RESOURCE_ASSIGNMENT_REQUIRED', message: 'Choisissez à la fois un praticien et un fauteuil, ou laissez les deux champs vides.' } });
        }
        if (providerId && operatoryId) {
          const availability = await client.query(
            `SELECT
               EXISTS (
                 SELECT 1 FROM clinic_providers p
                 JOIN clinics c ON c.organization_id = p.organization_id AND c.id = p.clinic_id
                 JOIN provider_working_hours h ON h.organization_id = p.organization_id AND h.clinic_id = p.clinic_id
                   AND h.provider_id = p.id
                   AND h.day_of_week = EXTRACT(DOW FROM ($3::timestamptz AT TIME ZONE c.timezone))::int
                 WHERE p.organization_id = $1 AND p.clinic_id = $2 AND p.id = $5 AND p.active
                   AND ($3::timestamptz AT TIME ZONE c.timezone)::date = ($4::timestamptz AT TIME ZONE c.timezone)::date
                   AND ($3::timestamptz AT TIME ZONE c.timezone)::time >= h.starts_at
                   AND ($4::timestamptz AT TIME ZONE c.timezone)::time <= h.ends_at
               ) AS provider_available,
               EXISTS (SELECT 1 FROM clinic_operatories o WHERE o.organization_id = $1 AND o.clinic_id = $2 AND o.id = $7 AND o.active) AS operatory_available,
               EXISTS (SELECT 1 FROM appointments a WHERE a.organization_id = $1 AND a.clinic_id = $2
                 AND a.id <> $6 AND a.status NOT IN ('CANCELLED', 'NO_SHOW') AND a.provider_id = $5
                 AND a.starts_at < $4::timestamptz AND a.ends_at > $3::timestamptz) AS provider_conflict,
               EXISTS (SELECT 1 FROM appointments a WHERE a.organization_id = $1 AND a.clinic_id = $2
                 AND a.id <> $6 AND a.status NOT IN ('CANCELLED', 'NO_SHOW') AND a.operatory_id = $7
                 AND a.starts_at < $4::timestamptz AND a.ends_at > $3::timestamptz) AS operatory_conflict`,
            [request.params.organizationId, request.params.clinicId, request.body.startsAt, request.body.endsAt,
              providerId, request.params.appointmentId, operatoryId],
          );
          const result = availability.rows[0];
          if (!result.provider_available || !result.operatory_available || result.provider_conflict || result.operatory_conflict) {
            await client.query('ROLLBACK'); transactionOpen = false;
            return reply.code(409).send({ error: { code: 'RESOURCE_CONFLICT', message: !result.provider_available
              ? 'Le praticien ne travaille pas à cette heure.'
              : !result.operatory_available ? 'Le fauteuil sélectionné n’est pas disponible.'
                : result.provider_conflict ? 'Le praticien a déjà un rendez-vous sur ce créneau.'
                  : 'Le fauteuil a déjà un rendez-vous sur ce créneau.' } });
          }
        }

        await client.query(
          `
            UPDATE appointments
            SET patient_id = $8, starts_at = $4::timestamptz, ends_at = $5::timestamptz,
                provider_id = $6, operatory_id = $7,
                reason = CASE WHEN $9::boolean THEN $10::text ELSE reason END,
                updated_at = clock_timestamp()
            WHERE organization_id = $1 AND clinic_id = $2 AND id = $3
          `,
          [request.params.organizationId, request.params.clinicId, request.params.appointmentId, request.body.startsAt, request.body.endsAt, providerId, operatoryId, patientId, request.body.reason !== undefined, request.body.reason?.trim() || null],
        );
        await client.query(
          `
            INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
            VALUES ($1, $2, $3, $4, 'APPOINTMENT', $5, $6::jsonb)
          `,
          [
            randomUUID(),
            request.params.organizationId,
            access.userId,
            request.body.patientId !== undefined || request.body.reason !== undefined ? 'APPOINTMENT_UPDATED' : 'APPOINTMENT_RESCHEDULED',
            request.params.appointmentId,
            JSON.stringify({ clinicId: request.params.clinicId, startsAt: request.body.startsAt, endsAt: request.body.endsAt, providerId, operatoryId, patientId, reasonChanged: request.body.reason !== undefined }),
          ],
        );
        await client.query('COMMIT');
        transactionOpen = false;
        return { data: { id: request.params.appointmentId, startsAt: request.body.startsAt, endsAt: request.body.endsAt, providerId, operatoryId } };
      } catch (error) {
        if (transactionOpen) await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  );
};
