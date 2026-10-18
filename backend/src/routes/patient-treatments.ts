import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { canReadOdontogram, canWriteOdontogram, denyInsufficientRole, requireClinicAccess } from '../auth/authorization.js';
import { pool } from '../db/pool.js';
import { canTransitionTreatmentStatus, isValidFdiTooth, isValidToothSurfaceForTooth } from '../domain/patient-treatment-policy.js';

interface PatientParams { organizationId: string; clinicId: string; patientId: string; }
interface TreatmentParams extends PatientParams { treatmentId: string; }
type TreatmentStatus = 'PLANNED' | 'ACCEPTED' | 'COMPLETED' | 'DECLINED';
type TreatmentCategory = 'EXAM' | 'HYGIENE' | 'RESTORATIVE' | 'ENDODONTICS' | 'EXTRACTION' | 'PROSTHODONTICS' | 'ORTHODONTICS' | 'PERIODONTICS' | 'IMPLANT' | 'OTHER';
type ToothSurface = 'WHOLE' | 'OCCLUSAL' | 'INCISAL' | 'MESIAL' | 'DISTAL' | 'BUCCAL' | 'LINGUAL' | 'PALATAL' | 'CERVICAL';
interface ToothSite { toothNo: number; surface: ToothSurface; }
interface CreateTreatmentBody {
  title: string;
  category: TreatmentCategory;
  status?: TreatmentStatus;
  notes?: string | null;
  appointmentId?: string | null;
  toothSites?: ToothSite[];
}
interface ChangeTreatmentStatusBody { status: TreatmentStatus; }

const categories: TreatmentCategory[] = ['EXAM','HYGIENE','RESTORATIVE','ENDODONTICS','EXTRACTION','PROSTHODONTICS','ORTHODONTICS','PERIODONTICS','IMPLANT','OTHER'];
const statuses: TreatmentStatus[] = ['PLANNED','ACCEPTED','COMPLETED','DECLINED'];
const surfaces: ToothSurface[] = ['WHOLE','OCCLUSAL','INCISAL','MESIAL','DISTAL','BUCCAL','LINGUAL','PALATAL','CERVICAL'];
const createSchema = {
  type: 'object', additionalProperties: false, required: ['title', 'category'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    category: { type: 'string', enum: categories },
    status: { type: 'string', enum: statuses },
    notes: { anyOf: [{ type: 'string', maxLength: 10000 }, { type: 'null' }] },
    appointmentId: { anyOf: [{ type: 'string', minLength: 1, maxLength: 100 }, { type: 'null' }] },
    toothSites: {
      type: 'array', maxItems: 85, uniqueItems: true,
      items: {
        type: 'object', additionalProperties: false, required: ['toothNo', 'surface'],
        properties: {
          toothNo: { type: 'integer', minimum: 11, maximum: 85 },
          surface: { type: 'string', enum: surfaces },
        },
      },
    },
  },
} as const;
const statusSchema = {
  type: 'object', additionalProperties: false, required: ['status'],
  properties: { status: { type: 'string', enum: statuses } },
} as const;

function deny(reply: FastifyReply): null {
  return denyInsufficientRole(reply);
}

const treatmentSelect = `
  pt.id,
  pt.patient_id AS "patientId",
  pt.appointment_id AS "appointmentId",
  to_char(ap.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "appointmentStartsAt",
  ap.reason AS "appointmentReason",
  pt.title,
  pt.category,
  pt.status,
  pt.notes,
  to_char(pt.performed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "performedAt",
  pt.performed_by_id AS "performedById",
  performer.name AS "performedByName",
  pt.recorded_by_id AS "recordedById",
  recorder.name AS "recordedByName",
  to_char(pt.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
  to_char(pt.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt",
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('toothNo', ts.tooth_no, 'surface', ts.surface) ORDER BY ts.tooth_no, ts.surface)
    FROM patient_treatment_teeth ts
    WHERE ts.organization_id = pt.organization_id AND ts.clinic_id = pt.clinic_id AND ts.treatment_id = pt.id
  ), '[]'::jsonb) AS "toothSites",
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'action', ev.action, 'fromStatus', ev.from_status, 'toStatus', ev.to_status,
      'actorName', actor.name,
      'createdAt', to_char(ev.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    ) ORDER BY ev.created_at DESC)
    FROM patient_treatment_events ev
    LEFT JOIN app_users actor ON actor.id = ev.actor_id
    WHERE ev.organization_id = pt.organization_id AND ev.clinic_id = pt.clinic_id AND ev.treatment_id = pt.id
  ), '[]'::jsonb) AS events
`;
const joins = `
  LEFT JOIN appointments ap ON ap.organization_id = pt.organization_id AND ap.clinic_id = pt.clinic_id AND ap.id = pt.appointment_id
  LEFT JOIN app_users performer ON performer.id = pt.performed_by_id
  LEFT JOIN app_users recorder ON recorder.id = pt.recorded_by_id
`;

export const patientTreatmentRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: PatientParams }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/treatments',
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canReadOdontogram(access)) return deny(reply);
      const result = await pool.query(
        `SELECT ${treatmentSelect}
         FROM patient_treatments pt
         ${joins}
         WHERE pt.organization_id = $1 AND pt.clinic_id = $2 AND pt.patient_id = $3
         ORDER BY COALESCE(pt.performed_at, pt.created_at) DESC, pt.created_at DESC
         LIMIT 500`,
        [request.params.organizationId, request.params.clinicId, request.params.patientId],
      );
      if (!result.rows.length) {
        const patient = await pool.query(
          'SELECT 1 FROM patient_clinics WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3',
          [request.params.organizationId, request.params.clinicId, request.params.patientId],
        );
        if (!patient.rowCount) return reply.code(404).send({ error: { code: 'PATIENT_NOT_FOUND', message: 'Patient introuvable dans cette clinique.' } });
      }
      return { data: result.rows, count: result.rows.length };
    },
  );

  app.post<{ Params: PatientParams; Body: CreateTreatmentBody }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/treatments',
    { schema: { body: createSchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return deny(reply);

      const patient = await pool.query(
        'SELECT 1 FROM patient_clinics WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3',
        [request.params.organizationId, request.params.clinicId, request.params.patientId],
      );
      if (!patient.rowCount) return reply.code(404).send({ error: { code: 'PATIENT_NOT_FOUND', message: 'Patient introuvable dans cette clinique.' } });

      const title = request.body.title.trim();
      if (!title) {
        return reply.code(400).send({
          error: { code: 'INVALID_TREATMENT_TITLE', message: 'Le titre du soin est obligatoire.' },
        });
      }

      const status = request.body.status ?? 'PLANNED';
      const toothSites = request.body.toothSites ?? [];
      if (!categories.includes(request.body.category) || !statuses.includes(status)) {
        return reply.code(400).send({ error: { code: 'INVALID_TREATMENT', message: 'Catégorie ou statut de soin invalide.' } });
      }
      if (toothSites.some((site) => !isValidFdiTooth(site.toothNo) || !isValidToothSurfaceForTooth(site.toothNo, site.surface))) {
        return reply.code(400).send({ error: { code: 'INVALID_TOOTH_SITE', message: 'Numéro de dent ou surface FDI invalide.' } });
      }
      const uniqueSites = new Set(toothSites.map((site) => `${site.toothNo}:${site.surface}`));
      if (uniqueSites.size !== toothSites.length) {
        return reply.code(400).send({ error: { code: 'DUPLICATE_TOOTH_SITE', message: 'Une dent et une surface ne peuvent être répétées dans le même soin.' } });
      }

      if (request.body.appointmentId) {
        const appointment = await pool.query(
          `SELECT 1 FROM appointments
           WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3 AND id = $4`,
          [request.params.organizationId, request.params.clinicId, request.params.patientId, request.body.appointmentId],
        );
        if (!appointment.rowCount) return reply.code(400).send({ error: { code: 'APPOINTMENT_PATIENT_MISMATCH', message: 'Le rendez-vous sélectionné ne correspond pas à ce patient.' } });
      }

      const client = await pool.connect();
      let transactionOpen = false;
      const treatmentId = randomUUID();
      try {
        await client.query('BEGIN');
        transactionOpen = true;
        const performedAt = status === 'COMPLETED' ? new Date().toISOString() : null;
        await client.query(
          `INSERT INTO patient_treatments
            (id, organization_id, clinic_id, patient_id, appointment_id, title, category, status, notes, performed_at, performed_by_id, recorded_by_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11, $12)`,
          [treatmentId, request.params.organizationId, request.params.clinicId, request.params.patientId,
            request.body.appointmentId ?? null, title, request.body.category, status,
            request.body.notes?.trim() || null, performedAt, status === 'COMPLETED' ? access.userId : null, access.userId],
        );
        for (const site of toothSites) {
          await client.query(
            `INSERT INTO patient_treatment_teeth (id, organization_id, clinic_id, treatment_id, tooth_no, surface)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [randomUUID(), request.params.organizationId, request.params.clinicId, treatmentId, site.toothNo, site.surface],
          );
        }
        await client.query(
          `INSERT INTO patient_treatment_events (id, organization_id, clinic_id, patient_id, treatment_id, actor_id, action, from_status, to_status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, 'CREATED', NULL, $7, $8::jsonb)`,
          [randomUUID(), request.params.organizationId, request.params.clinicId, request.params.patientId, treatmentId,
            access.userId, status, JSON.stringify({ category: request.body.category, toothSiteCount: toothSites.length })],
        );
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, 'PATIENT_TREATMENT_CREATED', 'PATIENT_TREATMENT', $4, $5::jsonb)`,
          [randomUUID(), request.params.organizationId, access.userId, treatmentId,
            JSON.stringify({ clinicId: request.params.clinicId, patientId: request.params.patientId, status })],
        );
        const result = await client.query(
          `SELECT ${treatmentSelect} FROM patient_treatments pt ${joins}
           WHERE pt.organization_id = $1 AND pt.clinic_id = $2 AND pt.patient_id = $3 AND pt.id = $4`,
          [request.params.organizationId, request.params.clinicId, request.params.patientId, treatmentId],
        );
        await client.query('COMMIT');
        transactionOpen = false;
        return reply.code(201).send({ data: result.rows[0] });
      } catch (error) {
        if (transactionOpen) await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  );

  app.patch<{ Params: TreatmentParams; Body: ChangeTreatmentStatusBody }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/treatments/:treatmentId/status',
    { schema: { body: statusSchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return deny(reply);
      if (!statuses.includes(request.body.status)) return reply.code(400).send({ error: { code: 'INVALID_STATUS', message: 'Statut de soin invalide.' } });

      const client = await pool.connect();
      let transactionOpen = false;
      try {
        await client.query('BEGIN');
        transactionOpen = true;
        const current = await client.query<{ status: TreatmentStatus }>(
          `SELECT status FROM patient_treatments
           WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3 AND id = $4 FOR UPDATE`,
          [request.params.organizationId, request.params.clinicId, request.params.patientId, request.params.treatmentId],
        );
        const from = current.rows[0]?.status;
        if (!from) {
          await client.query('ROLLBACK'); transactionOpen = false;
          return reply.code(404).send({ error: { code: 'TREATMENT_NOT_FOUND', message: 'Soin introuvable.' } });
        }
        if (!canTransitionTreatmentStatus(from, request.body.status)) {
          await client.query('ROLLBACK'); transactionOpen = false;
          return reply.code(409).send({ error: { code: 'INVALID_STATUS_TRANSITION', message: 'Cette transition de statut n’est pas autorisée.' } });
        }
        await client.query(
          `UPDATE patient_treatments
           SET status = $5, performed_at = CASE WHEN $5 = 'COMPLETED' THEN now() ELSE NULL END,
               performed_by_id = CASE WHEN $5 = 'COMPLETED' THEN $6 ELSE NULL END, updated_at = now()
           WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3 AND id = $4`,
          [request.params.organizationId, request.params.clinicId, request.params.patientId, request.params.treatmentId, request.body.status, access.userId],
        );
        await client.query(
          `INSERT INTO patient_treatment_events (id, organization_id, clinic_id, patient_id, treatment_id, actor_id, action, from_status, to_status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, 'STATUS_CHANGED', $7, $8, '{}'::jsonb)`,
          [randomUUID(), request.params.organizationId, request.params.clinicId, request.params.patientId, request.params.treatmentId, access.userId, from, request.body.status],
        );
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, 'PATIENT_TREATMENT_STATUS_CHANGED', 'PATIENT_TREATMENT', $4, $5::jsonb)`,
          [randomUUID(), request.params.organizationId, access.userId, request.params.treatmentId,
            JSON.stringify({ clinicId: request.params.clinicId, patientId: request.params.patientId, from, to: request.body.status })],
        );
        await client.query('COMMIT');
        transactionOpen = false;
        return { data: { id: request.params.treatmentId, status: request.body.status } };
      } catch (error) {
        if (transactionOpen) await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  );
};
