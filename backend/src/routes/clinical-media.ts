import { createHash, randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { canReadOdontogram, canWriteOdontogram, denyInsufficientRole, requireClinicAccess } from '../auth/authorization.js';
import { pool } from '../db/pool.js';
import { allowedClinicalMimeTypes, isClinicalMediaCategoryCompatible, isValidClinicalBase64, matchesClinicalFileSignature, maxClinicalMediaBytes, safeClinicalFilename, type ClinicalMediaType } from '../domain/clinical-media-policy.js';

interface MediaParams {
  organizationId: string;
  clinicId: string;
  patientId: string;
  encounterId: string;
  mediaId?: string;
}
const uploadSchema = {
  type: 'object', additionalProperties: false,
  required: ['mediaType', 'originalFilename', 'mimeType', 'contentBase64'],
  properties: {
    mediaType: { type: 'string', enum: ['XRAY', 'PHOTO', 'DOCUMENT'] },
    originalFilename: { type: 'string', minLength: 1, maxLength: 255 },
    mimeType: { type: 'string', enum: [...allowedClinicalMimeTypes] },
    contentBase64: { type: 'string', minLength: 1, maxLength: Math.ceil(maxClinicalMediaBytes * 4 / 3) + 8 },
    description: { anyOf: [{ type: 'string', maxLength: 2000 }, { type: 'null' }] },
    capturedAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
  },
} as const;

interface UploadBody {
  mediaType: ClinicalMediaType;
  originalFilename: string;
  mimeType: string;
  contentBase64: string;
  description?: string | null;
  capturedAt?: string | null;
}
export const clinicalMediaRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: MediaParams; Body: UploadBody }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId/media',
    { schema: { body: uploadSchema }, bodyLimit: 12 * 1024 * 1024 },
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canWriteOdontogram(access)) return denyInsufficientRole(reply);
      const patient = await pool.query(
        'SELECT 1 FROM patient_clinics WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3',
        [organizationId, clinicId, patientId],
      );
      if (!patient.rowCount) return reply.code(404).send({ error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found.' } });

      const filename = safeClinicalFilename(request.body.originalFilename.trim());
      const mimeType = request.body.mimeType.toLowerCase();
      if (!allowedClinicalMimeTypes.has(mimeType)) {
        return reply.code(415).send({ error: { code: 'UNSUPPORTED_CLINICAL_FILE', message: 'Use JPEG, PNG, WebP, PDF, or DICOM files.' } });
      }
      if (!isValidClinicalBase64(request.body.contentBase64)) {
        return reply.code(400).send({ error: { code: 'INVALID_FILE_ENCODING', message: 'The uploaded file is not valid base64 data.' } });
      }
      const bytes = Buffer.from(request.body.contentBase64, 'base64');
      if (!bytes.length || bytes.length > maxClinicalMediaBytes) {
        return reply.code(413).send({ error: { code: 'CLINICAL_FILE_TOO_LARGE', message: 'Clinical files must be 8 MiB or smaller.' } });
      }
      if (!matchesClinicalFileSignature(bytes, mimeType)) {
        return reply.code(415).send({ error: { code: 'FILE_SIGNATURE_MISMATCH', message: 'The file contents do not match the selected file type.' } });
      }
      const mediaType = request.body.mediaType;
      if (!isClinicalMediaCategoryCompatible(mediaType, mimeType)) {
        return reply.code(400).send({ error: { code: 'MEDIA_TYPE_MISMATCH', message: 'Choose a category compatible with the file type.' } });
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
          return reply.code(409).send({ error: { code: 'ENCOUNTER_CLOSED', message: 'Closed visits cannot accept additional files.' } });
        }
        const id = randomUUID();
        const checksum = createHash('sha256').update(bytes).digest('hex');
        const result = await client.query(
          `INSERT INTO clinical_media
             (id, organization_id, clinic_id, patient_id, encounter_id, media_type, storage_key, original_filename,
              mime_type, size_bytes, checksum_sha256, content_bytes, captured_at, description, uploaded_by_id)
           VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,$10,$11,$12,$13,$14)
           RETURNING id, media_type AS "mediaType", original_filename AS "originalFilename", mime_type AS "mimeType",
                     size_bytes AS "sizeBytes", (content_bytes IS NOT NULL) AS "hasPrivateContent",
                     captured_at AS "capturedAt", description, created_at AS "createdAt"`,
          [id, organizationId, clinicId, patientId, encounterId, mediaType, filename, mimeType, bytes.length,
            checksum, bytes, request.body.capturedAt ?? null, request.body.description?.trim() || null, access.userId],
        );
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1,$2,$3,'CLINICAL_MEDIA_UPLOADED','CLINICAL_MEDIA',$4,$5::jsonb)`,
          [randomUUID(), organizationId, access.userId, id, JSON.stringify({ clinicId, patientId, encounterId, mediaType, mimeType, sizeBytes: bytes.length, checksum })],
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

  app.get<{ Params: MediaParams }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/encounters/:encounterId/media/:mediaId/content',
    async (request, reply) => {
      const { organizationId, clinicId, patientId, encounterId, mediaId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!canReadOdontogram(access)) return denyInsufficientRole(reply);
      const result = await pool.query<{ contentBytes: Buffer; mimeType: string; originalFilename: string; checksumSha256: string }>(
        `SELECT content_bytes AS "contentBytes", mime_type AS "mimeType", original_filename AS "originalFilename",
                checksum_sha256 AS "checksumSha256"
         FROM clinical_media
         WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND encounter_id=$4 AND id=$5`,
        [organizationId, clinicId, patientId, encounterId, mediaId],
      );
      const media = result.rows[0];
      if (!media || !media.contentBytes) return reply.code(404).send({ error: { code: 'CLINICAL_MEDIA_NOT_FOUND', message: 'Clinical file not found.' } });
      const actualChecksum = createHash('sha256').update(media.contentBytes).digest('hex');
      if (actualChecksum !== media.checksumSha256) {
        await pool.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1,$2,$3,'CLINICAL_MEDIA_INTEGRITY_FAILED','CLINICAL_MEDIA',$4,$5::jsonb)`,
          [randomUUID(), organizationId, access.userId, mediaId, JSON.stringify({
            clinicId, patientId, encounterId, expectedChecksum: media.checksumSha256, actualChecksum,
          })],
        );
        request.log.error({ event: 'CLINICAL_MEDIA_INTEGRITY_FAILURE' }, 'Clinical media integrity check failed');
        return reply.code(500).send({ error: { code: 'CLINICAL_MEDIA_INTEGRITY_FAILURE', message: 'The clinical file failed its integrity check.' } });
      }
      reply.header('Content-Type', media.mimeType);
      reply.header('Content-Length', media.contentBytes.length);
      reply.header('Content-Disposition', `attachment; filename="clinical-file"; filename*=UTF-8''${encodeURIComponent(media.originalFilename)}`);
      reply.header('Cache-Control', 'private, no-store, max-age=0');
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Content-Security-Policy', "default-src 'none'; sandbox");
      reply.header('ETag', `"${media.checksumSha256}"`);
      await pool.query(
        `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1,$2,$3,'CLINICAL_MEDIA_DOWNLOADED','CLINICAL_MEDIA',$4,$5::jsonb)`,
        [randomUUID(), organizationId, access.userId, mediaId, JSON.stringify({ clinicId, patientId, encounterId, checksum: media.checksumSha256 })],
      );
      return reply.send(media.contentBytes);
    },
  );
};
