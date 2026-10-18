import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { canReadOdontogram, canWriteOdontogram, denyInsufficientRole, requireClinicAccess } from '../auth/authorization.js';
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
        pool.query('SELECT id, finding_code AS "findingCode", finding_type AS "findingType", description, severity, tooth_no AS "toothNo", surface, recorded_by_id AS "recordedById", created_at AS "createdAt" FROM clinical_findings WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND encounter_id=$4 ORDER BY created_at', [organizationId, clinicId, patientId, encounterId]),
        pool.query(
          `SELECT p.id, p.title, p.category, p.status, p.notes, p.performed_at AS "performedAt", p.performed_by_id AS "performedById",
                  p.recorded_by_id AS "recordedById", p.created_at AS "createdAt",
                  COALESCE((SELECT jsonb_agg(jsonb_build_object('toothNo', s.tooth_no, 'surface', s.surface) ORDER BY s.tooth_no, s.surface) FROM clinical_procedure_sites s WHERE s.procedure_id=p.id), '[]'::jsonb) AS "toothSites"
           FROM clinical_procedures p WHERE p.organization_id=$1 AND p.clinic_id=$2 AND p.patient_id=$3 AND p.encounter_id=$4 ORDER BY p.created_at`,
          [organizationId, clinicId, patientId, encounterId],
        ),
        pool.query('SELECT id, media_type AS "mediaType", storage_key AS "storageKey", original_filename AS "originalFilename", mime_type AS "mimeType", size_bytes AS "sizeBytes", checksum_sha256 AS "checksumSha256", captured_at AS "capturedAt", description, metadata, uploaded_by_id AS "uploadedById", created_at AS "createdAt" FROM clinical_media WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND encounter_id=$4 ORDER BY created_at DESC', [organizationId, clinicId, patientId, encounterId]),
        pool.query('SELECT id, due_at AS "dueAt", instruction, status, created_by_id AS "createdById", completed_by_id AS "completedById", completed_at AS "completedAt", created_at AS "createdAt" FROM clinical_follow_ups WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND encounter_id=$4 ORDER BY due_at NULLS LAST', [organizationId, clinicId, patientId, encounterId]),
        pool.query('SELECT p.user_id AS "userId", u.name, p.role, p.added_by_id AS "addedById", p.created_at AS "createdAt" FROM clinical_encounter_participants p JOIN app_users u ON u.id=p.user_id WHERE p.organization_id=$1 AND p.clinic_id=$2 AND p.patient_id=$3 AND p.encounter_id=$4 ORDER BY p.created_at', [organizationId, clinicId, patientId, encounterId]),
      ]);
      return { data: { ...encounter.rows[0], notes: notes.rows, findings: findings.rows, procedures: procedures.rows, media: media.rows, followUps: followUps.rows, participants: participants.rows } };
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

  app.post<{ Params: NoteParams }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId/notes/:noteId/sign',
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId, noteId } = request.params;
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
