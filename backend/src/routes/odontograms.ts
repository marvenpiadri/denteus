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
            updated_at AS "updatedAt"
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
              updated_at AS "updatedAt"
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
