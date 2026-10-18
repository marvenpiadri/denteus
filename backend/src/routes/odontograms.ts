import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import {
  canReadOdontogram,
  canWriteOdontogram,
  denyInsufficientRole,
  requireClinicAccess,
} from '../auth/authorization.js';
import { pool } from '../db/pool.js';
import { isValidFdiTooth } from '../domain/patient-treatment-policy.js';
import { hasOdontogramRevisionConflict } from '../domain/odontogram-policy.js';

interface OdontogramParams {
  organizationId: string;
  clinicId: string;
  patientId: string;
}

interface PlanChange {
  toothNo: number;
  axis: string;
  from: unknown;
  to: unknown;
}

interface SaveOdontogramBody {
  status: Record<string, unknown>;
  plan?: Record<string, unknown> | null;
  planChanges?: PlanChange[];
  extra?: Record<string, unknown>;
  expectedUpdatedAt?: string | null;
}

const odontogramBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'object', maxProperties: 200 },
    plan: { anyOf: [{ type: 'object', maxProperties: 200 }, { type: 'null' }] },
    planChanges: {
      type: 'array',
      maxItems: 2_000,
      items: {
        type: 'object',
        required: ['toothNo', 'axis'],
        properties: {
          toothNo: { type: 'integer', minimum: 1, maximum: 99 },
          axis: { type: 'string', minLength: 1, maxLength: 100 },
          from: {},
          to: {},
        },
      },
    },
    extra: { type: 'object', maxProperties: 200 },
    expectedUpdatedAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
  },
} as const;

export const odontogramRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: OdontogramParams }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/odontogram',
    async (request, reply) => {
      const access = await requireClinicAccess(
        request,
        reply,
        request.params.organizationId,
        request.params.clinicId,
      );
      if (!access) return;
      if (!canReadOdontogram(access)) return denyInsufficientRole(reply);

      const linkedPatient = await pool.query(
        `
          SELECT 1
          FROM patient_clinics
          WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3
        `,
        [
          request.params.organizationId,
          request.params.clinicId,
          request.params.patientId,
        ],
      );

      if (!linkedPatient.rowCount) {
        return reply.code(404).send({
          error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found.' },
        });
      }

      const result = await pool.query(
        `
          SELECT
            id,
            patient_id AS "patientId",
            organization_id AS "organizationId",
            clinic_id AS "clinicId",
            status_payload AS status,
            plan_payload AS plan,
            plan_changes AS "planChanges",
            extra_payload AS extra,
            updated_by_id AS "updatedById",
            created_at AS "createdAt",
            to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"
          FROM odontogram_records
          WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3
          LIMIT 1
        `,
        [
          request.params.organizationId,
          request.params.clinicId,
          request.params.patientId,
        ],
      );

      return { data: result.rows[0] ?? null };
    },
  );

  app.get<{ Params: OdontogramParams }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/odontogram/revisions',
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canReadOdontogram(access)) return denyInsufficientRole(reply);

      const result = await pool.query(
        `
          SELECT
            revision.version_no AS "versionNo",
            revision.snapshot,
            revision.recorded_by_id AS "recordedById",
            actor.name AS "recordedByName",
            revision.created_at AS "createdAt"
          FROM odontogram_revisions revision
          LEFT JOIN app_users actor ON actor.id = revision.recorded_by_id
          WHERE revision.organization_id = $1
            AND revision.clinic_id = $2
            AND revision.patient_id = $3
          ORDER BY revision.version_no DESC
          LIMIT 100
        `,
        [request.params.organizationId, request.params.clinicId, request.params.patientId],
      );

      if (!result.rows.length) {
        const patient = await pool.query(
          'SELECT 1 FROM patient_clinics WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3',
          [request.params.organizationId, request.params.clinicId, request.params.patientId],
        );
        if (!patient.rowCount) {
          return reply.code(404).send({ error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found.' } });
        }
      }

      return { data: result.rows, count: result.rows.length };
    },
  );
  app.put<{ Params: OdontogramParams; Body: SaveOdontogramBody }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/odontogram',
    { schema: { body: odontogramBodySchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(
        request,
        reply,
        request.params.organizationId,
        request.params.clinicId,
      );
      if (!access) return;
      if (!canWriteOdontogram(access)) return denyInsufficientRole(reply);

      const linkedPatient = await pool.query(
        `
          SELECT 1
          FROM patient_clinics
          WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3
        `,
        [
          request.params.organizationId,
          request.params.clinicId,
          request.params.patientId,
        ],
      );

      if (!linkedPatient.rowCount) {
        return reply.code(404).send({
          error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found.' },
        });
      }

      const invalidPlanChange = (request.body.planChanges ?? []).find(
        (change) => !isValidFdiTooth(change.toothNo),
      );
      if (invalidPlanChange) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_FDI_TOOTH',
            message: 'Chaque modification du plan doit référencer une dent FDI valide.',
          },
        });
      }

      const client = await pool.connect();
      let transactionOpen = false;

      try {
        await client.query('BEGIN');
        transactionOpen = true;

        // Serialize writes for this patient's chart so concurrent first saves and edits
        // cannot both pass the revision check.
        const recordLockKey = [request.params.organizationId, request.params.clinicId, request.params.patientId].join(':');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [recordLockKey]);
        const currentRecord = await client.query<{ updatedAt: string }>(
          `SELECT to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt" FROM odontogram_records WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3 FOR UPDATE`,
          [request.params.organizationId, request.params.clinicId, request.params.patientId],
        );
        const currentUpdatedAt = currentRecord.rows[0]?.updatedAt;
        const expectedUpdatedAt = request.body.expectedUpdatedAt ?? null;
        const hasConflict = hasOdontogramRevisionConflict(currentUpdatedAt, expectedUpdatedAt);
        if (hasConflict) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return reply.code(409).send({
            error: { code: 'ODONTOGRAM_CHANGED', message: 'Cet odontogramme a été modifié dans une autre session. Rechargez le dossier avant de réessayer.' },
          });
        }

        const result = await client.query(
          `
            INSERT INTO odontogram_records (
              id, organization_id, clinic_id, patient_id,
              status_payload, plan_payload, plan_changes, extra_payload, updated_by_id
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9)
            ON CONFLICT (patient_id, clinic_id)
            DO UPDATE SET
              status_payload = EXCLUDED.status_payload,
              plan_payload = EXCLUDED.plan_payload,
              plan_changes = EXCLUDED.plan_changes,
              extra_payload = EXCLUDED.extra_payload,
              updated_by_id = EXCLUDED.updated_by_id,
              updated_at = now()
            RETURNING
              id,
              patient_id AS "patientId",
              organization_id AS "organizationId",
              clinic_id AS "clinicId",
              status_payload AS status,
              plan_payload AS plan,
              plan_changes AS "planChanges",
              extra_payload AS extra,
              updated_by_id AS "updatedById",
              created_at AS "createdAt",
              to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"
          `,
          [
            randomUUID(),
            request.params.organizationId,
            request.params.clinicId,
            request.params.patientId,
            JSON.stringify(request.body.status),
            request.body.plan === undefined || request.body.plan === null
              ? null
              : JSON.stringify(request.body.plan),
            JSON.stringify(request.body.planChanges ?? []),
            JSON.stringify(request.body.extra ?? {}),
            access.userId,
          ],
        );

        const revisionResult = await client.query<{ version_no: number }> (
          'SELECT COALESCE(MAX(version_no), 0) + 1 AS version_no FROM odontogram_revisions WHERE odontogram_id = $1',
          [result.rows[0].id],
        );
        const revisionNo = Number(revisionResult.rows[0].version_no);

        await client.query(
          'INSERT INTO odontogram_revisions (id, organization_id, clinic_id, patient_id, odontogram_id, version_no, snapshot, recorded_by_id) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)',
          [randomUUID(), request.params.organizationId, request.params.clinicId, request.params.patientId, result.rows[0].id, revisionNo, JSON.stringify({ status: result.rows[0].status, plan: result.rows[0].plan, planChanges: result.rows[0].planChanges, extra: result.rows[0].extra }), access.userId],
        );
        await client.query(
          `
            INSERT INTO audit_events (
              id, organization_id, user_id, action, resource_type, resource_id, metadata
            )
            VALUES ($1, $2, $3, 'ODONTOGRAM_UPDATED', 'ODONTOGRAM', $4, $5::jsonb)
          `,
          [
            randomUUID(),
            request.params.organizationId,
            access.userId,
            result.rows[0].id,
            JSON.stringify({
              clinicId: request.params.clinicId,
              patientId: request.params.patientId,
              revisionNo,
            }),
          ],
        );

        await client.query('COMMIT');
        transactionOpen = false;
        return { data: result.rows[0] };
      } catch (error) {
        if (transactionOpen) await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  );
};
