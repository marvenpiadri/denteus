import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { requireClinicAccess } from '../auth/authorization.js';
import { pool } from '../db/pool.js';
import { canManageAppointments } from '../domain/appointment-policy.js';

export const recallRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { organizationId: string; clinicId: string }; Querystring: { status?: string; q?: string } }>(
    '/organizations/:organizationId/clinics/:clinicId/recalls',
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Accès refusé.' } });
      const result = await pool.query(
        `SELECT r.id, r.patient_id AS "patientId", p.patient_number AS "patientNumber",
          p.first_name AS "patientFirstName", p.last_name AS "patientLastName", p.phone AS "patientPhone",
          r.recall_type AS "recallType", to_char(r.due_on, 'YYYY-MM-DD') AS "dueOn",
          to_char(r.previous_completed_on, 'YYYY-MM-DD') AS "previousCompletedOn",
          r.interval_months AS "intervalMonths", r.status, r.preferred_contact_method AS "preferredContactMethod",
          r.last_contacted_at AS "lastContactedAt", r.note
         FROM patient_recalls r JOIN patients p ON p.organization_id=r.organization_id AND p.id=r.patient_id
         WHERE r.organization_id=$1 AND r.clinic_id=$2
           AND ($3::text IS NULL OR r.status=$3)
           AND ($4::text IS NULL OR p.first_name ILIKE '%'||$4||'%' OR p.last_name ILIKE '%'||$4||'%' OR p.patient_number ILIKE '%'||$4||'%')
         ORDER BY r.due_on, p.last_name LIMIT 500`,
        [request.params.organizationId, request.params.clinicId, request.query.status ?? null, request.query.q?.trim() || null],
      );
      return { data: result.rows, count: result.rows.length };
    },
  );

  app.post<{ Params: { organizationId: string; clinicId: string }; Body: { patientId: string; recallType: string; dueOn: string; intervalMonths?: number; note?: string } }>(
    '/organizations/:organizationId/clinics/:clinicId/recalls',
    { schema: { body: { type: 'object', additionalProperties: false, required: ['patientId', 'recallType', 'dueOn'], properties: {
      patientId: { type: 'string', minLength: 1, maxLength: 100 },
      recallType: { type: 'string', minLength: 1, maxLength: 100 },
      dueOn: { type: 'string', format: 'date' },
      intervalMonths: { type: 'integer', minimum: 1, maximum: 120 },
      note: { type: 'string', maxLength: 2000 },
    } } } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Accès refusé.' } });
      const patient = await pool.query(
        'SELECT 1 FROM patient_clinics WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3',
        [request.params.organizationId, request.params.clinicId, request.body.patientId],
      );
      if (!patient.rowCount) return reply.code(404).send({ error: { code: 'PATIENT_NOT_FOUND', message: 'Patient introuvable dans cette clinique.' } });
      const id = randomUUID();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO patient_recalls (id, organization_id, clinic_id, patient_id, recall_type, due_on, interval_months, note, created_by_id)
           VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9)`,
          [id, request.params.organizationId, request.params.clinicId, request.body.patientId, request.body.recallType.trim(), request.body.dueOn, request.body.intervalMonths ?? 6, request.body.note?.trim() || null, access.userId],
        );
        await client.query(
          `INSERT INTO patient_recall_events (id, organization_id, clinic_id, recall_id, user_id, event_type, to_status)
           VALUES ($1,$2,$3,$4,$5,'CREATED','DUE')`,
          [randomUUID(), request.params.organizationId, request.params.clinicId, id, access.userId],
        );
        await client.query('COMMIT');
        return reply.code(201).send({ data: { id, status: 'DUE' } });
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
  );


  app.post<{ Params: { organizationId: string; clinicId: string; recallId: string }; Body: { contactMethod: string; outcome: string; note?: string } }>(
    '/organizations/:organizationId/clinics/:clinicId/recalls/:recallId/contacts',
    { schema: { body: { type: 'object', additionalProperties: false, required: ['contactMethod', 'outcome'], properties: {
      contactMethod: { type: 'string', enum: ['PHONE', 'SMS', 'EMAIL', 'WHATSAPP', 'IN_PERSON', 'UNKNOWN'] },
      outcome: { type: 'string', minLength: 1, maxLength: 100 },
      note: { type: 'string', maxLength: 2000 },
    } } } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Accès refusé.' } });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const current = await client.query<{ status: string }>(
          'SELECT status FROM patient_recalls WHERE organization_id=$1 AND clinic_id=$2 AND id=$3 FOR UPDATE',
          [request.params.organizationId, request.params.clinicId, request.params.recallId],
        );
        const from = current.rows[0]?.status;
        if (!from) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'RECALL_NOT_FOUND', message: 'Rappel introuvable.' } });
        }
        const to = from === 'DUE' ? 'CONTACTED' : from;
        await client.query(
          `INSERT INTO patient_recall_events (id, organization_id, clinic_id, recall_id, user_id, event_type, from_status, to_status, contact_method, outcome, note)
           VALUES ($1,$2,$3,$4,$5,'CONTACT_ATTEMPT',$6,$7,$8,$9,$10)`,
          [randomUUID(), request.params.organizationId, request.params.clinicId, request.params.recallId, access.userId, from, to, request.body.contactMethod, request.body.outcome.trim(), request.body.note?.trim() || null],
        );
        await client.query(
          `UPDATE patient_recalls SET status=$4, last_contacted_at=clock_timestamp(), updated_at=clock_timestamp()
           WHERE organization_id=$1 AND clinic_id=$2 AND id=$3`,
          [request.params.organizationId, request.params.clinicId, request.params.recallId, to],
        );
        await client.query('COMMIT');
        return { data: { id: request.params.recallId, status: to } };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  );


  app.patch<{ Params: { organizationId: string; clinicId: string; recallId: string }; Body: { status: string } }>(
    '/organizations/:organizationId/clinics/:clinicId/recalls/:recallId/status',
    { schema: { body: { type: 'object', additionalProperties: false, required: ['status'], properties: { status: { type: 'string', enum: ['DUE', 'CONTACTED', 'SCHEDULED', 'COMPLETED', 'DECLINED', 'INACTIVE'] } } } } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Accès refusé.' } });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const current = await client.query<{ status: string }>(
          'SELECT status FROM patient_recalls WHERE organization_id=$1 AND clinic_id=$2 AND id=$3 FOR UPDATE',
          [request.params.organizationId, request.params.clinicId, request.params.recallId],
        );
        const from = current.rows[0]?.status;
        if (!from) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'RECALL_NOT_FOUND', message: 'Rappel introuvable.' } });
        }
        await client.query(
          'UPDATE patient_recalls SET status=$4, updated_at=clock_timestamp() WHERE organization_id=$1 AND clinic_id=$2 AND id=$3',
          [request.params.organizationId, request.params.clinicId, request.params.recallId, request.body.status],
        );
        await client.query(
          `INSERT INTO patient_recall_events (id, organization_id, clinic_id, recall_id, user_id, event_type, from_status, to_status)
           VALUES ($1,$2,$3,$4,$5,'STATUS_CHANGED',$6,$7)`,
          [randomUUID(), request.params.organizationId, request.params.clinicId, request.params.recallId, access.userId, from, request.body.status],
        );
        await client.query('COMMIT');
        return { data: { id: request.params.recallId, status: request.body.status } };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  );

};
