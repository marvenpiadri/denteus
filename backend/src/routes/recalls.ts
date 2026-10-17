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
};
