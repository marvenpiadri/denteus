import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { canManagePatients, denyInsufficientRole, requireClinicAccess } from '../auth/authorization.js';
import { pool } from '../db/pool.js';

interface ClinicParams {
  organizationId: string;
  clinicId: string;
}

interface PatientParams extends ClinicParams {
  patientId: string;
}

interface PatientSearchQuery {
  q?: string;
}

interface CreatePatientBody {
  firstName: string;
  lastName: string;
  birthDate?: string;
  gender?: 'M' | 'F' | 'OTHER';
  nationalId?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
}

const patientBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['firstName', 'lastName'],
  properties: {
    firstName: { type: 'string', minLength: 1, maxLength: 100 },
    lastName: { type: 'string', minLength: 1, maxLength: 100 },
    birthDate: { type: 'string', format: 'date' },
    gender: { type: 'string', enum: ['M', 'F', 'OTHER'] },
    nationalId: { type: 'string', maxLength: 64 },
    phone: { type: 'string', maxLength: 40 },
    email: { type: 'string', maxLength: 254 },
    address: { type: 'string', maxLength: 500 },
    city: { type: 'string', maxLength: 120 },
    notes: { type: 'string', maxLength: 10_000 },
  },
} as const;

const patientSelect = `
  p.id,
  p.organization_id AS "organizationId",
  p.patient_number AS "patientNumber",
  p.first_name AS "firstName",
  p.last_name AS "lastName",
  p.birth_date AS "birthDate",
  p.gender,
  p.national_id AS "nationalId",
  p.phone,
  p.email,
  p.address,
  p.city,
  p.notes,
  p.created_at AS "createdAt",
  p.updated_at AS "updatedAt"
`;

export const patientRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: ClinicParams; Querystring: PatientSearchQuery }>(
    '/organizations/:organizationId/clinics/:clinicId/patients',
    async (request, reply) => {
      const access = await requireClinicAccess(
        request,
        reply,
        request.params.organizationId,
        request.params.clinicId,
      );
      if (!access) return;

      const query = (request.query.q ?? '').trim().slice(0, 120);
      const result = await pool.query(
        `
          SELECT ${patientSelect}
          FROM patients p
          JOIN patient_clinics pc
            ON pc.organization_id = p.organization_id
           AND pc.patient_id = p.id
          WHERE pc.organization_id = $1
            AND pc.clinic_id = $2
            AND (
              $3 = ''
              OR p.first_name ILIKE '%' || $3 || '%'
              OR p.last_name ILIKE '%' || $3 || '%'
              OR p.patient_number ILIKE '%' || $3 || '%'
              OR COALESCE(p.phone, '') ILIKE '%' || $3 || '%'
            )
          ORDER BY p.last_name, p.first_name
          LIMIT 100
        `,
        [request.params.organizationId, request.params.clinicId, query],
      );

      return { data: result.rows, count: result.rows.length };
    },
  );

  app.get<{ Params: PatientParams }>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId',
    async (request, reply) => {
      const access = await requireClinicAccess(
        request,
        reply,
        request.params.organizationId,
        request.params.clinicId,
      );
      if (!access) return;

      const result = await pool.query(
        `
          SELECT ${patientSelect}
          FROM patients p
          JOIN patient_clinics pc
            ON pc.organization_id = p.organization_id
           AND pc.patient_id = p.id
          WHERE pc.organization_id = $1
            AND pc.clinic_id = $2
            AND p.id = $3
          LIMIT 1
        `,
        [
          request.params.organizationId,
          request.params.clinicId,
          request.params.patientId,
        ],
      );

      if (!result.rows[0]) {
        return reply.code(404).send({
          error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found.' },
        });
      }

      return { data: result.rows[0] };
    },
  );

  app.post<{ Params: ClinicParams; Body: CreatePatientBody }>(
    '/organizations/:organizationId/clinics/:clinicId/patients',
    { schema: { body: patientBodySchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(
        request,
        reply,
        request.params.organizationId,
        request.params.clinicId,
      );
      if (!access) return;
      if (!canManagePatients(access)) return denyInsufficientRole(reply);

      const client = await pool.connect();
      let transactionOpen = false;

      try {
        await client.query('BEGIN');
        transactionOpen = true;

        const numberYear = new Date().getUTCFullYear();
        const counter = await client.query<{ last_value: string }>(
          `
            INSERT INTO patient_number_counters (organization_id, number_year, last_value)
            VALUES ($1, $2, 1)
            ON CONFLICT (organization_id, number_year)
            DO UPDATE SET last_value = patient_number_counters.last_value + 1
            RETURNING last_value
          `,
          [request.params.organizationId, numberYear],
        );

        const sequence = Number(counter.rows[0]?.last_value ?? 0);
        const patientNumber = `DEN-${numberYear}-${String(sequence).padStart(6, '0')}`;
        const patientId = randomUUID();

        const inserted = await client.query(
          `
            INSERT INTO patients (
              id, organization_id, patient_number, first_name, last_name,
              birth_date, gender, national_id, phone, email, address, city, notes
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
            RETURNING
              id,
              organization_id AS "organizationId",
              patient_number AS "patientNumber",
              first_name AS "firstName",
              last_name AS "lastName",
              birth_date AS "birthDate",
              gender,
              national_id AS "nationalId",
              phone,
              email,
              address,
              city,
              notes,
              created_at AS "createdAt",
              updated_at AS "updatedAt"
          `,
          [
            patientId,
            request.params.organizationId,
            patientNumber,
            request.body.firstName.trim(),
            request.body.lastName.trim(),
            request.body.birthDate ?? null,
            request.body.gender ?? null,
            request.body.nationalId?.trim() || null,
            request.body.phone?.trim() || null,
            request.body.email?.trim().toLowerCase() || null,
            request.body.address?.trim() || null,
            request.body.city?.trim() || null,
            request.body.notes?.trim() || null,
          ],
        );

        await client.query(
          `
            INSERT INTO patient_clinics (organization_id, patient_id, clinic_id)
            VALUES ($1, $2, $3)
          `,
          [request.params.organizationId, patientId, request.params.clinicId],
        );

        await client.query(
          `
            INSERT INTO audit_events (
              id, organization_id, user_id, action, resource_type, resource_id, metadata
            )
            VALUES ($1, $2, $3, 'PATIENT_CREATED', 'PATIENT', $4, $5::jsonb)
          `,
          [
            randomUUID(),
            request.params.organizationId,
            access.userId,
            patientId,
            JSON.stringify({ clinicId: request.params.clinicId, patientNumber }),
          ],
        );

        await client.query('COMMIT');
        transactionOpen = false;
        return reply.code(201).send({ data: inserted.rows[0] });
      } catch (error) {
        if (transactionOpen) await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  );
};
