import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { canReadOdontogram, canWriteOdontogram, denyInsufficientRole, hasActiveClinicalProvider, requireClinicAccess } from '../auth/authorization.js';
import { pool } from '../db/pool.js';

interface PatientParams { organizationId: string; clinicId: string; patientId: string; }
interface EncounterParams extends PatientParams { encounterId: string; }
interface NoteParams extends EncounterParams { noteId: string; }
type EncounterType = 'CONSULTATION' | 'EMERGENCY' | 'FOLLOW_UP' | 'PROCEDURE' | 'OTHER';
type NoteType = 'CHIEF_COMPLAINT' | 'EXAMINATION' | 'ASSESSMENT' | 'PROGRESS' | 'DISCHARGE' | 'OTHER';
interface CreateEncounterBody {
  appointmentId?: string | null;
  encounterType?: EncounterType;
  responsibleProviderId?: string | null;
  startedAt?: string;
  chiefComplaint?: string | null;
}
interface CreateNoteBody { noteType?: NoteType; content: string; }
interface AmendNoteBody { reason: string; amendedContent: string; }
interface CreateFindingBody { findingType: 'OBSERVATION' | 'DIAGNOSIS' | 'SYMPTOM' | 'RISK' | 'OTHER'; description: string; severity?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | null; toothNo?: number | null; surface?: string | null; findingCode?: string | null; }
interface CreateProcedureBody { title: string; category: 'EXAM' | 'HYGIENE' | 'RESTORATIVE' | 'ENDODONTICS' | 'EXTRACTION' | 'PROSTHODONTICS' | 'ORTHODONTICS' | 'PERIODONTICS' | 'IMPLANT' | 'OTHER'; notes?: string | null; toothSites?: Array<{ toothNo: number; surface: string }>; }
interface ProcedureParams extends EncounterParams { procedureId: string; }
interface FindingParams extends EncounterParams { findingId: string; }
interface FollowUpParams extends EncounterParams { followUpId: string; }
interface CreateFollowUpBody { instruction: string; dueAt?: string | null; }
interface RecordAmendmentBody { reason: string; content: string; }

const encounterTypes: EncounterType[] = ['CONSULTATION', 'EMERGENCY', 'FOLLOW_UP', 'PROCEDURE', 'OTHER'];
const noteTypes: NoteType[] = ['CHIEF_COMPLAINT', 'EXAMINATION', 'ASSESSMENT', 'PROGRESS', 'DISCHARGE', 'OTHER'];

const createEncounterSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    appointmentId: { anyOf: [{ type: 'string', minLength: 1, maxLength: 100 }, { type: 'null' }] },
    encounterType: { type: 'string', enum: encounterTypes },
    responsibleProviderId: { anyOf: [{ type: 'string', minLength: 1, maxLength: 100 }, { type: 'null' }] },
    startedAt: { type: 'string', format: 'date-time' },
    chiefComplaint: { anyOf: [{ type: 'string', maxLength: 4000 }, { type: 'null' }] },
  },
} as const;
const createNoteSchema = {
  type: 'object', additionalProperties: false, required: ['content'],
  properties: {
    noteType: { type: 'string', enum: noteTypes },
    content: { type: 'string', minLength: 1, maxLength: 20000 },
  },
} as const;
const toothNumbers = [11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48,51,52,53,54,55,61,62,63,64,65,71,72,73,74,75,81,82,83,84,85];
const toothSurfaces = ['WHOLE','OCCLUSAL','INCISAL','MESIAL','DISTAL','BUCCAL','LINGUAL','PALATAL','CERVICAL'];
const procedureCategories = ['EXAM','HYGIENE','RESTORATIVE','ENDODONTICS','EXTRACTION','PROSTHODONTICS','ORTHODONTICS','PERIODONTICS','IMPLANT','OTHER'];
const createFindingSchema = {
  type: 'object', additionalProperties: false, required: ['findingType', 'description'],
  properties: {
    findingType: { type: 'string', enum: ['OBSERVATION','DIAGNOSIS','SYMPTOM','RISK','OTHER'] },
    description: { type: 'string', minLength: 1, maxLength: 10000 },
    findingCode: { anyOf: [{ type: 'string', maxLength: 100 }, { type: 'null' }] },
    severity: { anyOf: [{ type: 'string', enum: ['LOW','MODERATE','HIGH','CRITICAL'] }, { type: 'null' }] },
    toothNo: { anyOf: [{ type: 'integer', enum: toothNumbers }, { type: 'null' }] },
    surface: { anyOf: [{ type: 'string', enum: toothSurfaces }, { type: 'null' }] },
  },
} as const;
const createProcedureSchema = {
  type: 'object', additionalProperties: false, required: ['title','category'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    category: { type: 'string', enum: procedureCategories },
    notes: { anyOf: [{ type: 'string', maxLength: 10000 }, { type: 'null' }] },
    toothSites: { type: 'array', maxItems: 32, items: {
      type: 'object', additionalProperties: false, required: ['toothNo','surface'],
      properties: { toothNo: { type: 'integer', enum: toothNumbers }, surface: { type: 'string', enum: toothSurfaces } },
    } },
  },
} as const;
const createFollowUpSchema = { type: 'object', additionalProperties: false, required: ['instruction'], properties: { instruction: { type: 'string', minLength: 1, maxLength: 4000 }, dueAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] } } } as const;
const recordAmendmentSchema = { type: 'object', additionalProperties: false, required: ['reason','content'], properties: { reason: { type: 'string', minLength: 1, maxLength: 1000 }, content: { type: 'string', minLength: 1, maxLength: 20000 } } } as const;
const amendNoteSchema = {
  type: 'object', additionalProperties: false, required: ['reason', 'amendedContent'],
  properties: {
    reason: { type: 'string', minLength: 1, maxLength: 1000 },
    amendedContent: { type: 'string', minLength: 1, maxLength: 20000 },
  },
} as const;

async function findPatient(organizationId: string, clinicId: string, patientId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM patient_clinics WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3',
    [organizationId, clinicId, patientId],
  );
  return Boolean(result.rowCount);
}

export const clinicalEncounterRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { organizationId: string; clinicId: string } }>(
    '/organizations/:organizationId/clinics/:clinicId/clinical-providers',
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canReadOdontogram(access)) return denyInsufficientRole(reply);
      const result = await pool.query(
        `SELECT id, display_name AS "displayName", role FROM clinic_providers
         WHERE organization_id=$1 AND clinic_id=$2 AND active=true AND role IN ('DENTIST','ORTHODONTIST')
         ORDER BY display_name`,
        [request.params.organizationId, request.params.clinicId],
      );
      return { data: result.rows, count: result.rowCount };
    },
  );
  app.get<{ Params: PatientParams }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters',
    async (request, reply) => {
      const { organizationId, clinicId, patientId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canReadOdontogram(access)) return denyInsufficientRole(reply);

      const result = await pool.query(
        `SELECT e.id, e.appointment_id AS "appointmentId", e.status, e.encounter_type AS "encounterType",
                e.responsible_provider_id AS "responsibleProviderId", provider.display_name AS "responsibleDentistName",
                e.started_at AS "startedAt", e.ended_at AS "endedAt", e.chief_complaint AS "chiefComplaint",
                e.created_by_id AS "createdById", creator.name AS "createdByName", e.signed_by_id AS "signedById",
                e.signed_at AS "signedAt", e.version, e.created_at AS "createdAt", e.updated_at AS "updatedAt",
                (SELECT count(*)::int FROM clinical_notes n WHERE n.encounter_id = e.id) AS "noteCount",
                (SELECT count(*)::int FROM clinical_procedures p WHERE p.encounter_id = e.id) AS "procedureCount",
                (SELECT count(*)::int FROM clinical_media m WHERE m.encounter_id = e.id) AS "mediaCount"
         FROM clinical_encounters e
         LEFT JOIN clinic_providers provider ON provider.organization_id = e.organization_id AND provider.clinic_id = e.clinic_id AND provider.id = e.responsible_provider_id
         LEFT JOIN app_users creator ON creator.id = e.created_by_id
         WHERE e.organization_id = $1 AND e.clinic_id = $2 AND e.patient_id = $3
         ORDER BY e.started_at DESC, e.created_at DESC LIMIT 250`,
        [organizationId, clinicId, patientId],
      );
      if (!result.rowCount && !(await findPatient(organizationId, clinicId, patientId))) {
        return reply.code(404).send({ error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found.' } });
      }
      return { data: result.rows, count: result.rowCount };
    },
  );

  app.post<{ Params: PatientParams; Body: CreateEncounterBody }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters',
    { schema: { body: createEncounterSchema } },
    async (request, reply) => {
      const { organizationId, clinicId, patientId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return denyInsufficientRole(reply);
      if (!(await findPatient(organizationId, clinicId, patientId))) {
        return reply.code(404).send({ error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found.' } });
      }

      const appointmentId = request.body.appointmentId ?? null;
      if (appointmentId) {
        const appointment = await pool.query<{ provider_id: string | null }>(
          'SELECT provider_id FROM appointments WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3 AND id = $4',
          [organizationId, clinicId, patientId, appointmentId],
        );
        if (!appointment.rowCount) {
          return reply.code(400).send({ error: { code: 'APPOINTMENT_PATIENT_MISMATCH', message: 'Appointment does not belong to this patient and clinic.' } });
        }
        if (request.body.responsibleProviderId === undefined && appointment.rows[0].provider_id) request.body.responsibleProviderId = appointment.rows[0].provider_id;
      }

      const providerId = request.body.responsibleProviderId ?? null;
      if (!providerId) return reply.code(400).send({ error: { code: 'RESPONSIBLE_PROVIDER_REQUIRED', message: 'Choose the treating dentist for this visit.' } });
      const provider = await pool.query(
        `SELECT 1 FROM clinic_providers WHERE organization_id = $1 AND clinic_id = $2 AND id = $3 AND active = true AND role IN ('DENTIST','ORTHODONTIST')`,
        [organizationId, clinicId, providerId],
      );
      if (!provider.rowCount) return reply.code(400).send({ error: { code: 'INVALID_RESPONSIBLE_PROVIDER', message: 'Choose an active dentist or orthodontist from this clinic.' } });

      const encounterId = randomUUID();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `INSERT INTO clinical_encounters
             (id, organization_id, clinic_id, patient_id, appointment_id, encounter_type, responsible_provider_id, started_at, chief_complaint, created_by_id, updated_by_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()), $9, $10, $10)
           RETURNING id, appointment_id AS "appointmentId", status, encounter_type AS "encounterType",
                     responsible_provider_id AS "responsibleProviderId", started_at AS "startedAt",
                     chief_complaint AS "chiefComplaint", created_by_id AS "createdById",
                     version, created_at AS "createdAt", updated_at AS "updatedAt"`,
          [encounterId, organizationId, clinicId, patientId, appointmentId, request.body.encounterType ?? 'CONSULTATION',
            providerId, request.body.startedAt ?? null, request.body.chiefComplaint?.trim() || null, access.userId],
        );
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, 'CLINICAL_ENCOUNTER_CREATED', 'CLINICAL_ENCOUNTER', $4, $5::jsonb)`,
          [randomUUID(), organizationId, access.userId, encounterId, JSON.stringify({ clinicId, patientId, appointmentId })],
        );
        await client.query('COMMIT');
        return reply.code(201).send({ data: result.rows[0] });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  );

  app.get<{ Params: EncounterParams }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId',
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canReadOdontogram(access)) return denyInsufficientRole(reply);

      const encounter = await pool.query(
        `SELECT e.id, e.appointment_id AS "appointmentId", e.status, e.encounter_type AS "encounterType",
                e.responsible_provider_id AS "responsibleProviderId", provider.display_name AS "responsibleDentistName",
                e.started_at AS "startedAt", e.ended_at AS "endedAt", e.chief_complaint AS "chiefComplaint",
                e.created_by_id AS "createdById", creator.name AS "createdByName",
                e.signed_by_id AS "signedById", signer.name AS "signedByName", e.signed_at AS "signedAt",
                e.version, e.created_at AS "createdAt", e.updated_at AS "updatedAt"
         FROM clinical_encounters e
         LEFT JOIN clinic_providers provider ON provider.organization_id = e.organization_id AND provider.clinic_id = e.clinic_id AND provider.id = e.responsible_provider_id
         LEFT JOIN app_users creator ON creator.id = e.created_by_id
         LEFT JOIN app_users signer ON signer.id = e.signed_by_id
         WHERE e.organization_id = $1 AND e.clinic_id = $2 AND e.patient_id = $3 AND e.id = $4`,
        [organizationId, clinicId, patientId, encounterId],
      );
      if (!encounter.rowCount) return reply.code(404).send({ error: { code: 'ENCOUNTER_NOT_FOUND', message: 'Clinical encounter not found.' } });

      const [notes, findings, procedures, media, followUps, participants] = await Promise.all([
        pool.query(
          `SELECT n.id, n.note_type AS "noteType", n.content, n.created_by_id AS "createdById", author.name AS "createdByName",
                  n.updated_by_id AS "updatedById", n.signed_by_id AS "signedById", signer.name AS "signedByName",
                  n.signed_at AS "signedAt", n.version, n.created_at AS "createdAt", n.updated_at AS "updatedAt",
                  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'reason', a.reason, 'amendedContent', a.amended_content, 'amendedById', a.amended_by_id, 'createdAt', a.created_at) ORDER BY a.created_at)
                    FROM clinical_note_amendments a WHERE a.note_id = n.id), '[]'::jsonb) AS amendments
           FROM clinical_notes n LEFT JOIN app_users author ON author.id = n.created_by_id LEFT JOIN app_users signer ON signer.id = n.signed_by_id
           WHERE n.organization_id = $1 AND n.clinic_id = $2 AND n.patient_id = $3 AND n.encounter_id = $4 ORDER BY n.created_at`,
          [organizationId, clinicId, patientId, encounterId],
        ),
        pool.query(
          `SELECT f.id, f.finding_code AS "findingCode", f.finding_type AS "findingType", f.description, f.severity, f.tooth_no AS "toothNo", f.surface, f.recorded_by_id AS "recordedById", f.created_at AS "createdAt",
                  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'reason', a.reason, 'correctedDescription', a.corrected_description, 'amendedById', a.amended_by_id, 'createdAt', a.created_at) ORDER BY a.created_at) FROM clinical_finding_amendments a WHERE a.finding_id=f.id), '[]'::jsonb) AS amendments
           FROM clinical_findings f WHERE f.organization_id=$1 AND f.clinic_id=$2 AND f.patient_id=$3 AND f.encounter_id=$4 ORDER BY f.created_at`,
          [organizationId, clinicId, patientId, encounterId],
        ),
        pool.query(
          `SELECT p.id, p.title, p.category, p.status, p.notes, p.performed_at AS "performedAt", p.performed_by_id AS "performedById",
                  p.recorded_by_id AS "recordedById", p.created_at AS "createdAt",
                  COALESCE((SELECT jsonb_agg(jsonb_build_object('toothNo', s.tooth_no, 'surface', s.surface) ORDER BY s.tooth_no, s.surface) FROM clinical_procedure_sites s WHERE s.procedure_id=p.id), '[]'::jsonb) AS "toothSites",
                  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'reason', a.reason, 'correctionDetails', a.correction_details, 'amendedById', a.amended_by_id, 'createdAt', a.created_at) ORDER BY a.created_at) FROM clinical_procedure_amendments a WHERE a.procedure_id=p.id), '[]'::jsonb) AS amendments
           FROM clinical_procedures p WHERE p.organization_id=$1 AND p.clinic_id=$2 AND p.patient_id=$3 AND p.encounter_id=$4 ORDER BY p.created_at`,
          [organizationId, clinicId, patientId, encounterId],
        ),
        pool.query('SELECT id, media_type AS "mediaType", (content_bytes IS NOT NULL) AS "hasPrivateContent", original_filename AS "originalFilename", mime_type AS "mimeType", size_bytes AS "sizeBytes", captured_at AS "capturedAt", description, created_at AS "createdAt" FROM clinical_media WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND encounter_id=$4 ORDER BY created_at DESC', [organizationId, clinicId, patientId, encounterId]),
        pool.query('SELECT id, due_at AS "dueAt", instruction, status, created_by_id AS "createdById", completed_by_id AS "completedById", completed_at AS "completedAt", created_at AS "createdAt" FROM clinical_follow_ups WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND encounter_id=$4 ORDER BY due_at NULLS LAST', [organizationId, clinicId, patientId, encounterId]),
        pool.query('SELECT p.user_id AS "userId", u.name, p.role, p.added_by_id AS "addedById", p.created_at AS "createdAt" FROM clinical_encounter_participants p JOIN app_users u ON u.id=p.user_id WHERE p.organization_id=$1 AND p.clinic_id=$2 AND p.patient_id=$3 AND p.encounter_id=$4 ORDER BY p.created_at', [organizationId, clinicId, patientId, encounterId]),
      ]);
      return { data: { ...encounter.rows[0], notes: notes.rows, findings: findings.rows, procedures: procedures.rows, media: media.rows, followUps: followUps.rows, participants: participants.rows } };
    },
  );

  app.post<{ Params: EncounterParams; Body: CreateFollowUpBody }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId/follow-ups',
    { schema: { body: createFollowUpSchema } },
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return denyInsufficientRole(reply);
      const instruction = request.body.instruction.trim();
      if (!instruction) return reply.code(400).send({ error: { code: 'EMPTY_FOLLOW_UP', message: 'A follow-up instruction is required.' } });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const encounter = await client.query(
          'SELECT status FROM clinical_encounters WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND id=$4 FOR UPDATE',
          [organizationId, clinicId, patientId, encounterId],
        );
        if (!encounter.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'ENCOUNTER_NOT_FOUND', message: 'Clinical encounter not found.' } });
        }
        if (['SIGNED', 'CANCELLED'].includes(encounter.rows[0].status)) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: { code: 'ENCOUNTER_CLOSED', message: 'This encounter no longer accepts new follow-up instructions.' } });
        }
        const result = await client.query(
          `INSERT INTO clinical_follow_ups (id, organization_id, clinic_id, patient_id, encounter_id, due_at, instruction, status, created_by_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'OPEN',$8)
           RETURNING id, due_at AS "dueAt", instruction, status, created_by_id AS "createdById", created_at AS "createdAt"`,
          [randomUUID(), organizationId, clinicId, patientId, encounterId, request.body.dueAt ?? null, instruction, access.userId],
        );
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1,$2,$3,'CLINICAL_FOLLOW_UP_CREATED','CLINICAL_FOLLOW_UP',$4,$5::jsonb)`,
          [randomUUID(), organizationId, access.userId, result.rows[0].id, JSON.stringify({ clinicId, patientId, encounterId, dueAt: request.body.dueAt ?? null })],
        );
        await client.query('COMMIT');
        return reply.code(201).send({ data: result.rows[0] });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  );

  app.post<{ Params: FollowUpParams }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId/follow-ups/:followUpId/complete',
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId, followUpId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return denyInsufficientRole(reply);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `UPDATE clinical_follow_ups
           SET status='COMPLETED', completed_by_id=$6, completed_at=now(), updated_at=now()
           WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND encounter_id=$4 AND id=$5
             AND status IN ('OPEN','SCHEDULED')
           RETURNING id, due_at AS "dueAt", instruction, status, completed_by_id AS "completedById", completed_at AS "completedAt"`,
          [organizationId, clinicId, patientId, encounterId, followUpId, access.userId],
        );
        if (!result.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: { code: 'FOLLOW_UP_NOT_COMPLETABLE', message: 'This follow-up is already completed, cancelled, or unavailable.' } });
        }
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1,$2,$3,'CLINICAL_FOLLOW_UP_COMPLETED','CLINICAL_FOLLOW_UP',$4,$5::jsonb)`,
          [randomUUID(), organizationId, access.userId, followUpId, JSON.stringify({ clinicId, patientId, encounterId })],
        );
        await client.query('COMMIT');
        return { data: result.rows[0] };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  );

  app.post<{ Params: EncounterParams; Body: CreateFindingBody }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId/findings',
    { schema: { body: createFindingSchema } },
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return denyInsufficientRole(reply);
      const description = request.body.description.trim();
      if (!description) return reply.code(400).send({ error: { code: 'EMPTY_FINDING', message: 'A clinical finding description is required.' } });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const encounter = await client.query('SELECT status FROM clinical_encounters WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND id=$4 FOR UPDATE', [organizationId, clinicId, patientId, encounterId]);
        if (!encounter.rowCount) { await client.query('ROLLBACK'); return reply.code(404).send({ error: { code: 'ENCOUNTER_NOT_FOUND', message: 'Clinical encounter not found.' } }); }
        if (['SIGNED','CANCELLED'].includes(encounter.rows[0].status)) { await client.query('ROLLBACK'); return reply.code(409).send({ error: { code: 'ENCOUNTER_CLOSED', message: 'This encounter no longer accepts findings.' } }); }
        if (request.body.surface && !request.body.toothNo) { await client.query('ROLLBACK'); return reply.code(400).send({ error: { code: 'TOOTH_REQUIRED', message: 'Choose a tooth before recording a surface.' } }); }
        const result = await client.query(
          `INSERT INTO clinical_findings (id, organization_id, clinic_id, patient_id, encounter_id, finding_code, finding_type, description, severity, tooth_no, surface, recorded_by_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING id, finding_code AS "findingCode", finding_type AS "findingType", description, severity, tooth_no AS "toothNo", surface, recorded_by_id AS "recordedById", created_at AS "createdAt"`,
          [randomUUID(), organizationId, clinicId, patientId, encounterId, request.body.findingCode?.trim() || null, request.body.findingType, description, request.body.severity ?? null, request.body.toothNo ?? null, request.body.surface ?? null, access.userId],
        );
        await client.query(`INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata) VALUES ($1,$2,$3,'CLINICAL_FINDING_CREATED','CLINICAL_FINDING',$4,$5::jsonb)`, [randomUUID(), organizationId, access.userId, result.rows[0].id, JSON.stringify({ clinicId, patientId, encounterId, toothNo: request.body.toothNo ?? null })]);
        await client.query('COMMIT');
        return reply.code(201).send({ data: result.rows[0] });
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
  );

  app.post<{ Params: EncounterParams; Body: CreateProcedureBody }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId/procedures',
    { schema: { body: createProcedureSchema } },
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return denyInsufficientRole(reply);
      const title = request.body.title.trim();
      if (!title) return reply.code(400).send({ error: { code: 'EMPTY_PROCEDURE', message: 'An act title is required.' } });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const encounter = await client.query('SELECT status FROM clinical_encounters WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND id=$4 FOR UPDATE', [organizationId, clinicId, patientId, encounterId]);
        if (!encounter.rowCount) { await client.query('ROLLBACK'); return reply.code(404).send({ error: { code: 'ENCOUNTER_NOT_FOUND', message: 'Clinical encounter not found.' } }); }
        if (['SIGNED','CANCELLED'].includes(encounter.rows[0].status)) { await client.query('ROLLBACK'); return reply.code(409).send({ error: { code: 'ENCOUNTER_CLOSED', message: 'This encounter no longer accepts acts.' } }); }
        const procedureId = randomUUID();
        await client.query(
          `INSERT INTO clinical_procedures (id, organization_id, clinic_id, patient_id, encounter_id, title, category, status, notes, recorded_by_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'PLANNED',$8,$9)`,
          [procedureId, organizationId, clinicId, patientId, encounterId, title, request.body.category, request.body.notes?.trim() || null, access.userId],
        );
        for (const site of request.body.toothSites ?? []) {
          await client.query('INSERT INTO clinical_procedure_sites (organization_id, clinic_id, patient_id, encounter_id, procedure_id, tooth_no, surface) VALUES ($1,$2,$3,$4,$5,$6,$7)', [organizationId, clinicId, patientId, encounterId, procedureId, site.toothNo, site.surface]);
        }
        await client.query(`INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata) VALUES ($1,$2,$3,'CLINICAL_PROCEDURE_PLANNED','CLINICAL_PROCEDURE',$4,$5::jsonb)`, [randomUUID(), organizationId, access.userId, procedureId, JSON.stringify({ clinicId, patientId, encounterId, toothSites: request.body.toothSites ?? [] })]);
        await client.query('COMMIT');
        return reply.code(201).send({ data: { id: procedureId, title, category: request.body.category, status: 'PLANNED' } });
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
  );

  app.post<{ Params: ProcedureParams }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId/procedures/:procedureId/complete',
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId, procedureId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return denyInsufficientRole(reply);
      const provider = await pool.query(`SELECT 1 FROM clinic_providers WHERE organization_id=$1 AND clinic_id=$2 AND user_id=$3 AND active=true AND role IN ('DENTIST','ORTHODONTIST')`, [organizationId, clinicId, access.userId]);
      if (!provider.rowCount) return reply.code(403).send({ error: { code: 'CLINICIAN_REQUIRED', message: 'Only an active dentist or orthodontist can mark an act as completed.' } });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const encounter = await client.query('SELECT status FROM clinical_encounters WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND id=$4 FOR UPDATE', [organizationId, clinicId, patientId, encounterId]);
        if (!encounter.rowCount) { await client.query('ROLLBACK'); return reply.code(404).send({ error: { code: 'ENCOUNTER_NOT_FOUND', message: 'Clinical encounter not found.' } }); }
        if (['SIGNED','CANCELLED'].includes(encounter.rows[0].status)) { await client.query('ROLLBACK'); return reply.code(409).send({ error: { code: 'ENCOUNTER_CLOSED', message: 'This encounter is closed.' } }); }
        const updated = await client.query(
          `UPDATE clinical_procedures SET status='COMPLETED', performed_at=now(), performed_by_id=$6, updated_at=now()
           WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND encounter_id=$4 AND id=$5 AND status IN ('PLANNED','IN_PROGRESS')
           RETURNING id, title, category, status, performed_at AS "performedAt", performed_by_id AS "performedById"`,
          [organizationId, clinicId, patientId, encounterId, procedureId, access.userId],
        );
        if (!updated.rowCount) { await client.query('ROLLBACK'); return reply.code(409).send({ error: { code: 'PROCEDURE_NOT_COMPLETABLE', message: 'This act is already completed, cancelled, or unavailable.' } }); }
        await client.query(`INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata) VALUES ($1,$2,$3,'CLINICAL_PROCEDURE_COMPLETED','CLINICAL_PROCEDURE',$4,$5::jsonb)`, [randomUUID(), organizationId, access.userId, procedureId, JSON.stringify({ clinicId, patientId, encounterId })]);
        await client.query('COMMIT');
        return { data: updated.rows[0] };
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
  );

  app.post<{ Params: FindingParams; Body: RecordAmendmentBody }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId/findings/:findingId/amendments',
    { schema: { body: recordAmendmentSchema } },
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId, findingId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return denyInsufficientRole(reply);
      if (!await hasActiveClinicalProvider(organizationId, clinicId, access.userId, ['DENTIST', 'ORTHODONTIST', 'HYGIENIST'])) return reply.code(403).send({ error: { code: 'CLINICIAN_REQUIRED', message: 'An active clinical provider account is required to amend a finding.' } });
      const reason=request.body.reason.trim(), content=request.body.content.trim();
      if(!reason||!content)return reply.code(400).send({error:{code:'INVALID_AMENDMENT',message:'A reason and corrected finding are required.'}});
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        const finding=await client.query('SELECT id FROM clinical_findings WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND encounter_id=$4 AND id=$5 FOR UPDATE',[organizationId,clinicId,patientId,encounterId,findingId]);
        if(!finding.rowCount){await client.query('ROLLBACK');return reply.code(404).send({error:{code:'FINDING_NOT_FOUND',message:'Clinical finding not found.'}});}
        const result=await client.query(`INSERT INTO clinical_finding_amendments (id,organization_id,clinic_id,patient_id,encounter_id,finding_id,reason,corrected_description,amended_by_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,reason,corrected_description AS "correctedDescription",amended_by_id AS "amendedById",created_at AS "createdAt"`,[randomUUID(),organizationId,clinicId,patientId,encounterId,findingId,reason,content,access.userId]);
        await client.query(`INSERT INTO audit_events (id,organization_id,user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'CLINICAL_FINDING_AMENDED','CLINICAL_FINDING',$4,$5::jsonb)`,[randomUUID(),organizationId,access.userId,findingId,JSON.stringify({clinicId,patientId,encounterId,amendmentId:result.rows[0].id,reason})]);
        await client.query('COMMIT');return reply.code(201).send({data:result.rows[0]});
      } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
    },
  );

  app.post<{ Params: ProcedureParams; Body: RecordAmendmentBody }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId/procedures/:procedureId/amendments',
    { schema: { body: recordAmendmentSchema } },
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId, procedureId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return denyInsufficientRole(reply);
      if (!await hasActiveClinicalProvider(organizationId, clinicId, access.userId, ['DENTIST', 'ORTHODONTIST'])) return reply.code(403).send({ error: { code: 'CLINICIAN_REQUIRED', message: 'An active dentist or orthodontist account is required to amend a completed act.' } });
      const reason=request.body.reason.trim(), content=request.body.content.trim();
      if(!reason||!content)return reply.code(400).send({error:{code:'INVALID_AMENDMENT',message:'A reason and correction details are required.'}});
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        const procedure=await client.query('SELECT status FROM clinical_procedures WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND encounter_id=$4 AND id=$5 FOR UPDATE',[organizationId,clinicId,patientId,encounterId,procedureId]);
        if(!procedure.rowCount){await client.query('ROLLBACK');return reply.code(404).send({error:{code:'PROCEDURE_NOT_FOUND',message:'Clinical procedure not found.'}});}
        if(procedure.rows[0].status!=='COMPLETED'){await client.query('ROLLBACK');return reply.code(409).send({error:{code:'PROCEDURE_NOT_COMPLETED',message:'Only completed acts require a correction amendment.'}});}
        const result=await client.query(`INSERT INTO clinical_procedure_amendments (id,organization_id,clinic_id,patient_id,encounter_id,procedure_id,reason,correction_details,amended_by_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,reason,correction_details AS "correctionDetails",amended_by_id AS "amendedById",created_at AS "createdAt"`,[randomUUID(),organizationId,clinicId,patientId,encounterId,procedureId,reason,content,access.userId]);
        await client.query(`INSERT INTO audit_events (id,organization_id,user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'CLINICAL_PROCEDURE_AMENDED','CLINICAL_PROCEDURE',$4,$5::jsonb)`,[randomUUID(),organizationId,access.userId,procedureId,JSON.stringify({clinicId,patientId,encounterId,amendmentId:result.rows[0].id,reason})]);
        await client.query('COMMIT');return reply.code(201).send({data:result.rows[0]});
      } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
    },
  );

  app.post<{ Params: EncounterParams; Body: CreateNoteBody }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId/notes',
    { schema: { body: createNoteSchema } },
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return denyInsufficientRole(reply);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const encounter = await client.query(
          'SELECT status FROM clinical_encounters WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND id=$4 FOR UPDATE',
          [organizationId, clinicId, patientId, encounterId],
        );
        if (!encounter.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'ENCOUNTER_NOT_FOUND', message: 'Clinical encounter not found.' } });
        }
        if (['SIGNED', 'CANCELLED'].includes(encounter.rows[0].status)) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: { code: 'ENCOUNTER_CLOSED', message: 'This encounter no longer accepts clinical notes.' } });
        }
        const content = request.body.content.trim();
        if (!content) {
          await client.query('ROLLBACK');
          return reply.code(400).send({ error: { code: 'EMPTY_NOTE', message: 'Clinical note content cannot be empty.' } });
        }
        const result = await client.query(
          `INSERT INTO clinical_notes (id, organization_id, clinic_id, patient_id, encounter_id, note_type, content, created_by_id, updated_by_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
           RETURNING id, note_type AS "noteType", content, created_by_id AS "createdById", signed_at AS "signedAt", version, created_at AS "createdAt", updated_at AS "updatedAt"`,
          [randomUUID(), organizationId, clinicId, patientId, encounterId, request.body.noteType ?? 'PROGRESS', content, access.userId],
        );
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1,$2,$3,'CLINICAL_NOTE_CREATED','CLINICAL_NOTE',$4,$5::jsonb)`,
          [randomUUID(), organizationId, access.userId, result.rows[0].id, JSON.stringify({ clinicId, patientId, encounterId, noteType: request.body.noteType ?? 'PROGRESS' })],
        );
        await client.query('COMMIT');
        return reply.code(201).send({ data: result.rows[0] });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  );

  app.post<{ Params: EncounterParams }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId/sign',
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return denyInsufficientRole(reply);
      if (!await hasActiveClinicalProvider(organizationId, clinicId, access.userId, ['DENTIST', 'ORTHODONTIST'])) {
        return reply.code(403).send({ error: { code: 'CLINICIAN_REQUIRED', message: 'Only an active dentist or orthodontist can sign a clinical encounter.' } });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const encounter = await client.query(
          'SELECT status FROM clinical_encounters WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND id=$4 FOR UPDATE',
          [organizationId, clinicId, patientId, encounterId],
        );
        if (!encounter.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'ENCOUNTER_NOT_FOUND', message: 'Clinical encounter not found.' } });
        }
        if (encounter.rows[0].status === 'SIGNED') {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: { code: 'ENCOUNTER_ALREADY_SIGNED', message: 'This encounter has already been signed.' } });
        }
        if (encounter.rows[0].status === 'CANCELLED') {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: { code: 'ENCOUNTER_CANCELLED', message: 'A cancelled encounter cannot be signed.' } });
        }
        const notes = await client.query(
          'SELECT count(*)::int AS total, count(*) FILTER (WHERE signed_at IS NULL)::int AS unsigned FROM clinical_notes WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND encounter_id=$4',
          [organizationId, clinicId, patientId, encounterId],
        );
        if (notes.rows[0].total === 0 || notes.rows[0].unsigned > 0) {
          await client.query('ROLLBACK');
          return reply.code(409).send({
            error: { code: 'ENCOUNTER_NOT_READY_TO_SIGN', message: 'Add at least one clinical note and sign every note before closing this encounter.' },
          });
        }
        const signed = await client.query(
          `UPDATE clinical_encounters
           SET status='SIGNED', signed_by_id=$5, signed_at=now(), ended_at=COALESCE(ended_at, now()),
               updated_by_id=$5, updated_at=now(), version=version+1
           WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND id=$4
           RETURNING id, status, signed_by_id AS "signedById", signed_at AS "signedAt", ended_at AS "endedAt", version`,
          [organizationId, clinicId, patientId, encounterId, access.userId],
        );
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1,$2,$3,'CLINICAL_ENCOUNTER_SIGNED','CLINICAL_ENCOUNTER',$4,$5::jsonb)`,
          [randomUUID(), organizationId, access.userId, encounterId, JSON.stringify({ clinicId, patientId, signedNoteCount: notes.rows[0].total })],
        );
        await client.query('COMMIT');
        return { data: signed.rows[0] };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  );

  app.post<{ Params: NoteParams }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId/notes/:noteId/sign',
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId, noteId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return denyInsufficientRole(reply);
      if (!await hasActiveClinicalProvider(organizationId, clinicId, access.userId, ['DENTIST', 'ORTHODONTIST', 'HYGIENIST'])) {
        return reply.code(403).send({ error: { code: 'CLINICIAN_REQUIRED', message: 'An active clinical provider account is required to sign this note.' } });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const encounter = await client.query(
          'SELECT status FROM clinical_encounters WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND id=$4 FOR UPDATE',
          [organizationId, clinicId, patientId, encounterId],
        );
        if (!encounter.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'ENCOUNTER_NOT_FOUND', message: 'Clinical encounter not found.' } });
        }
        if (['SIGNED', 'CANCELLED'].includes(encounter.rows[0].status)) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: { code: 'ENCOUNTER_CLOSED', message: 'This encounter is already closed.' } });
        }
        const note = await client.query(
          'SELECT signed_at FROM clinical_notes WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND encounter_id=$4 AND id=$5 FOR UPDATE',
          [organizationId, clinicId, patientId, encounterId, noteId],
        );
        if (!note.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'NOTE_NOT_FOUND', message: 'Clinical note not found.' } });
        }
        if (note.rows[0].signed_at) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: { code: 'NOTE_ALREADY_SIGNED', message: 'This note has already been signed.' } });
        }
        const signed = await client.query(
          'UPDATE clinical_notes SET signed_at=now(), signed_by_id=$6, updated_by_id=$6, version=version+1, updated_at=now() WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND encounter_id=$4 AND id=$5 RETURNING id, signed_at AS "signedAt", signed_by_id AS "signedById", version',
          [organizationId, clinicId, patientId, encounterId, noteId, access.userId],
        );
        await client.query(
          "INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata) VALUES ($1,$2,$3,'CLINICAL_NOTE_SIGNED','CLINICAL_NOTE',$4,$5::jsonb)",
          [randomUUID(), organizationId, access.userId, noteId, JSON.stringify({ clinicId, patientId, encounterId })],
        );
        await client.query('COMMIT');
        return { data: signed.rows[0] };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  );

  app.post<{ Params: NoteParams; Body: AmendNoteBody }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId/notes/:noteId/amendments',
    { schema: { body: amendNoteSchema } },
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId, noteId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return denyInsufficientRole(reply);
      if (!await hasActiveClinicalProvider(organizationId, clinicId, access.userId, ['DENTIST', 'ORTHODONTIST', 'HYGIENIST'])) return reply.code(403).send({ error: { code: 'CLINICIAN_REQUIRED', message: 'An active clinical provider account is required to amend a signed note.' } });
      const reason = request.body.reason.trim(), amendedContent = request.body.amendedContent.trim();
      if (!reason || !amendedContent) {
        return reply.code(400).send({ error: { code: 'INVALID_AMENDMENT', message: 'A reason and corrected content are required.' } });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const note = await client.query(
          'SELECT signed_at FROM clinical_notes WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND encounter_id=$4 AND id=$5 FOR UPDATE',
          [organizationId, clinicId, patientId, encounterId, noteId],
        );
        if (!note.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'NOTE_NOT_FOUND', message: 'Clinical note not found.' } });
        }
        if (!note.rows[0].signed_at) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: { code: 'NOTE_NOT_SIGNED', message: 'Only signed notes can be amended.' } });
        }
        const result = await client.query(
          `INSERT INTO clinical_note_amendments (id, organization_id, clinic_id, patient_id, encounter_id, note_id, reason, amended_content, amended_by_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING id, reason, amended_content AS "amendedContent", amended_by_id AS "amendedById", created_at AS "createdAt"`,
          [randomUUID(), organizationId, clinicId, patientId, encounterId, noteId, reason, amendedContent, access.userId],
        );
        await client.query(
          "INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata) VALUES ($1,$2,$3,'CLINICAL_NOTE_AMENDED','CLINICAL_NOTE',$4,$5::jsonb)",
          [randomUUID(), organizationId, access.userId, noteId, JSON.stringify({ clinicId, patientId, encounterId, amendmentId: result.rows[0].id, reason })],
        );
        await client.query('COMMIT');
        return reply.code(201).send({ data: result.rows[0] });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  );
};
