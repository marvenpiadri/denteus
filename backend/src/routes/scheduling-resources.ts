import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { requireClinicAccess } from '../auth/authorization.js';
import { canManageAppointments } from '../domain/appointment-policy.js';
import { pool } from '../db/pool.js';

interface ClinicParams { organizationId: string; clinicId: string; }
interface ProviderParams extends ClinicParams { providerId: string; }
interface CreateProviderBody {
  displayName: string;
  role: 'DENTIST' | 'ORTHODONTIST' | 'HYGIENIST' | 'ASSISTANT' | 'SPECIALIST';
  color?: string;
  userId?: string | null;
}
interface CreateOperatoryBody { name: string; chairNumber?: number | null; color?: string; }
interface WorkingHoursBody { dayOfWeek: number; startsAt: string; endsAt: string; }

const providerSchema = {
  type: 'object', additionalProperties: false, required: ['displayName', 'role'],
  properties: {
    displayName: { type: 'string', minLength: 1, maxLength: 160 },
    role: { type: 'string', enum: ['DENTIST', 'ORTHODONTIST', 'HYGIENIST', 'ASSISTANT', 'SPECIALIST'] },
    color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
    userId: { anyOf: [{ type: 'string', minLength: 1, maxLength: 100 }, { type: 'null' }] },
  },
} as const;
const operatorySchema = {
  type: 'object', additionalProperties: false, required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    chairNumber: { anyOf: [{ type: 'integer', minimum: 1, maximum: 999 }, { type: 'null' }] },
    color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
  },
} as const;
const workingHoursSchema = {
  type: 'object', additionalProperties: false, required: ['dayOfWeek', 'startsAt', 'endsAt'],
  properties: {
    dayOfWeek: { type: 'integer', minimum: 0, maximum: 6 },
    startsAt: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
    endsAt: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
  },
} as const;

function deny(reply: FastifyReply): null {
  reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Votre rôle ne permet pas de gérer le planning.' } });
  return null;
}

const bulkWorkingHoursSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['hours'],
  properties: {
    hours: {
      type: 'array',
      maxItems: 7,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dayOfWeek', 'startsAt', 'endsAt'],
        properties: {
          dayOfWeek: { type: 'integer', minimum: 0, maximum: 6 },
          startsAt: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d
  app.get<{ Params: ClinicParams }>('/organizations/:organizationId/clinics/:clinicId/scheduling-resources', async (request, reply) => {
    const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
    if (!access) return;
    if (!canManageAppointments(access.effectiveRole)) return deny(reply);

    const [providers, operatories] = await Promise.all([
      pool.query(
        `SELECT p.id, p.display_name AS "displayName", p.role, p.color, p.user_id AS "userId", p.active,
                COALESCE(jsonb_agg(jsonb_build_object(
                  'dayOfWeek', h.day_of_week,
                  'startsAt', to_char(h.starts_at, 'HH24:MI'),
                  'endsAt', to_char(h.ends_at, 'HH24:MI')
                ) ORDER BY h.day_of_week) FILTER (WHERE h.id IS NOT NULL), '[]'::jsonb) AS "workingHours"
         FROM clinic_providers p
         LEFT JOIN provider_working_hours h
           ON h.organization_id = p.organization_id AND h.clinic_id = p.clinic_id AND h.provider_id = p.id
         WHERE p.organization_id = $1 AND p.clinic_id = $2 AND p.active = true
         GROUP BY p.id ORDER BY p.display_name`,
        [request.params.organizationId, request.params.clinicId],
      ),
      pool.query(
        `SELECT id, name, chair_number AS "chairNumber", color, active
         FROM clinic_operatories WHERE organization_id = $1 AND clinic_id = $2 AND active = true
         ORDER BY chair_number NULLS LAST, name`,
        [request.params.organizationId, request.params.clinicId],
      ),
    ]);
    return { data: { providers: providers.rows, operatories: operatories.rows } };
  });

  app.post<{ Params: ClinicParams; Body: CreateProviderBody }>(
    '/organizations/:organizationId/clinics/:clinicId/scheduling-resources/providers',
    { schema: { body: providerSchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return deny(reply);
      if (request.body.userId) {
        const linkedUser = await pool.query(
          `SELECT 1
           FROM organization_memberships om
           LEFT JOIN clinic_memberships cm
             ON cm.organization_id = om.organization_id AND cm.clinic_id = $2 AND cm.user_id = om.user_id
           WHERE om.organization_id = $1 AND om.user_id = $3
             AND (om.role IN ('ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN') OR cm.user_id IS NOT NULL)
           LIMIT 1`,
          [request.params.organizationId, request.params.clinicId, request.body.userId],
        );
        if (!linkedUser.rowCount) {
          return reply.code(400).send({ error: { code: 'PROVIDER_USER_OUT_OF_SCOPE', message: 'Le compte sélectionné n’appartient pas à cette organisation ou clinique.' } });
        }
      }
      const result = await pool.query(
        `INSERT INTO clinic_providers (id, organization_id, clinic_id, user_id, display_name, role, color)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, display_name AS "displayName", role, color, user_id AS "userId", active`,
        [randomUUID(), request.params.organizationId, request.params.clinicId, request.body.userId ?? null,
          request.body.displayName.trim(), request.body.role, request.body.color ?? '#087f75'],
      );
      await pool.query(
        `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, 'CLINIC_PROVIDER_CREATED', 'CLINIC_PROVIDER', $4, $5::jsonb)`,
        [randomUUID(), request.params.organizationId, access.userId, result.rows[0].id,
          JSON.stringify({ clinicId: request.params.clinicId, role: request.body.role })],
      );
      return reply.code(201).send({ data: result.rows[0] });
    },
  );

  app.post<{ Params: ClinicParams; Body: CreateOperatoryBody }>(
    '/organizations/:organizationId/clinics/:clinicId/scheduling-resources/operatories',
    { schema: { body: operatorySchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return deny(reply);
      const result = await pool.query(
        `INSERT INTO clinic_operatories (id, organization_id, clinic_id, name, chair_number, color)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, chair_number AS "chairNumber", color, active`,
        [randomUUID(), request.params.organizationId, request.params.clinicId, request.body.name.trim(),
          request.body.chairNumber ?? null, request.body.color ?? '#267d93'],
      );
      await pool.query(
        `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, 'CLINIC_OPERATORY_CREATED', 'CLINIC_OPERATORY', $4, $5::jsonb)`,
        [randomUUID(), request.params.organizationId, access.userId, result.rows[0].id,
          JSON.stringify({ clinicId: request.params.clinicId, chairNumber: request.body.chairNumber ?? null })],
      );
      return reply.code(201).send({ data: result.rows[0] });
    },
  );

  app.put<{ Params: ProviderParams; Body: WorkingHoursBody }>(
    '/organizations/:organizationId/clinics/:clinicId/scheduling-resources/providers/:providerId/working-hours',
    { schema: { body: workingHoursSchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return deny(reply);
      if (request.body.endsAt <= request.body.startsAt) {
        return reply.code(400).send({ error: { code: 'INVALID_WORKING_HOURS', message: 'L’heure de fin doit être après l’heure de début.' } });
      }
      const provider = await pool.query(
        'SELECT id FROM clinic_providers WHERE organization_id = $1 AND clinic_id = $2 AND id = $3 AND active = true',
        [request.params.organizationId, request.params.clinicId, request.params.providerId],
      );
      if (!provider.rowCount) return reply.code(404).send({ error: { code: 'PROVIDER_NOT_FOUND', message: 'Praticien introuvable.' } });
      const result = await pool.query(
        `INSERT INTO provider_working_hours (id, organization_id, clinic_id, provider_id, day_of_week, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, $5, $6::time, $7::time)
         ON CONFLICT (organization_id, clinic_id, provider_id, day_of_week)
         DO UPDATE SET starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, updated_at = now()
         RETURNING day_of_week AS "dayOfWeek", to_char(starts_at, 'HH24:MI') AS "startsAt",
                   to_char(ends_at, 'HH24:MI') AS "endsAt"`,
        [randomUUID(), request.params.organizationId, request.params.clinicId, request.params.providerId,
          request.body.dayOfWeek, request.body.startsAt, request.body.endsAt],
      );
      await pool.query(
        `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, 'PROVIDER_WORKING_HOURS_UPDATED', 'CLINIC_PROVIDER', $4, $5::jsonb)`,
        [randomUUID(), request.params.organizationId, access.userId, request.params.providerId,
          JSON.stringify({ clinicId: request.params.clinicId, dayOfWeek: request.body.dayOfWeek,
            startsAt: request.body.startsAt, endsAt: request.body.endsAt })],
      );
      return { data: result.rows[0] };
    },
  );

  app.put<{ Params: ProviderParams; Body: BulkWorkingHoursBody }>(
    '/organizations/:organizationId/clinics/:clinicId/scheduling-resources/providers/:providerId/working-hours/bulk',
    { schema: { body: bulkWorkingHoursSchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return deny(reply);

      const hours = request.body.hours;
      const days = new Set(hours.map((hour) => hour.dayOfWeek));
      if (days.size !== hours.length || hours.some((hour) => hour.endsAt <= hour.startsAt)) {
        return reply.code(400).send({
          error: { code: 'INVALID_WORKING_HOURS', message: 'Chaque jour doit être unique et chaque heure de fin doit suivre son heure de début.' },
        });
      }

      const client = await pool.connect();
      let transactionOpen = false;
      try {
        await client.query('BEGIN');
        transactionOpen = true;
        const provider = await client.query(
          'SELECT id FROM clinic_providers WHERE organization_id = $1 AND clinic_id = $2 AND id = $3 AND active = true FOR UPDATE',
          [request.params.organizationId, request.params.clinicId, request.params.providerId],
        );
        if (!provider.rowCount) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return reply.code(404).send({ error: { code: 'PROVIDER_NOT_FOUND', message: 'Praticien introuvable.' } });
        }

        await client.query(
          'DELETE FROM provider_working_hours WHERE organization_id = $1 AND clinic_id = $2 AND provider_id = $3',
          [request.params.organizationId, request.params.clinicId, request.params.providerId],
        );
        for (const hour of hours) {
          await client.query(
            `INSERT INTO provider_working_hours (id, organization_id, clinic_id, provider_id, day_of_week, starts_at, ends_at)
             VALUES ($1, $2, $3, $4, $5, $6::time, $7::time)`,
            [randomUUID(), request.params.organizationId, request.params.clinicId, request.params.providerId,
              hour.dayOfWeek, hour.startsAt, hour.endsAt],
          );
        }
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, 'PROVIDER_WORKING_HOURS_REPLACED', 'CLINIC_PROVIDER', $4, $5::jsonb)`,
          [randomUUID(), request.params.organizationId, access.userId, request.params.providerId,
            JSON.stringify({ clinicId: request.params.clinicId, hours })],
        );
        await client.query('COMMIT');
        transactionOpen = false;
        return { data: { providerId: request.params.providerId, hours } };
      } catch (error) {
        if (transactionOpen) await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  );

  app.delete<{ Params: ProviderParams & { dayOfWeek: string } }>(
    '/organizations/:organizationId/clinics/:clinicId/scheduling-resources/providers/:providerId/working-hours/:dayOfWeek',
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return deny(reply);
      const dayOfWeek = Number(request.params.dayOfWeek);
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return reply.code(400).send({ error: { code: 'INVALID_WEEKDAY', message: 'Jour de semaine invalide.' } });
      }
      await pool.query(
        'DELETE FROM provider_working_hours WHERE organization_id = $1 AND clinic_id = $2 AND provider_id = $3 AND day_of_week = $4',
        [request.params.organizationId, request.params.clinicId, request.params.providerId, dayOfWeek],
      );
      await pool.query(
        `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, 'PROVIDER_WORKING_HOURS_REMOVED', 'CLINIC_PROVIDER', $4, $5::jsonb)`,
        [randomUUID(), request.params.organizationId, access.userId, request.params.providerId,
          JSON.stringify({ clinicId: request.params.clinicId, dayOfWeek })],
      );
      return reply.code(204).send();
    },
  );

};
 },
          endsAt: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d
  app.get<{ Params: ClinicParams }>('/organizations/:organizationId/clinics/:clinicId/scheduling-resources', async (request, reply) => {
    const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
    if (!access) return;
    if (!canManageAppointments(access.effectiveRole)) return deny(reply);

    const [providers, operatories] = await Promise.all([
      pool.query(
        `SELECT p.id, p.display_name AS "displayName", p.role, p.color, p.user_id AS "userId", p.active,
                COALESCE(jsonb_agg(jsonb_build_object(
                  'dayOfWeek', h.day_of_week,
                  'startsAt', to_char(h.starts_at, 'HH24:MI'),
                  'endsAt', to_char(h.ends_at, 'HH24:MI')
                ) ORDER BY h.day_of_week) FILTER (WHERE h.id IS NOT NULL), '[]'::jsonb) AS "workingHours"
         FROM clinic_providers p
         LEFT JOIN provider_working_hours h
           ON h.organization_id = p.organization_id AND h.clinic_id = p.clinic_id AND h.provider_id = p.id
         WHERE p.organization_id = $1 AND p.clinic_id = $2 AND p.active = true
         GROUP BY p.id ORDER BY p.display_name`,
        [request.params.organizationId, request.params.clinicId],
      ),
      pool.query(
        `SELECT id, name, chair_number AS "chairNumber", color, active
         FROM clinic_operatories WHERE organization_id = $1 AND clinic_id = $2 AND active = true
         ORDER BY chair_number NULLS LAST, name`,
        [request.params.organizationId, request.params.clinicId],
      ),
    ]);
    return { data: { providers: providers.rows, operatories: operatories.rows } };
  });

  app.post<{ Params: ClinicParams; Body: CreateProviderBody }>(
    '/organizations/:organizationId/clinics/:clinicId/scheduling-resources/providers',
    { schema: { body: providerSchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return deny(reply);
      if (request.body.userId) {
        const linkedUser = await pool.query(
          `SELECT 1
           FROM organization_memberships om
           LEFT JOIN clinic_memberships cm
             ON cm.organization_id = om.organization_id AND cm.clinic_id = $2 AND cm.user_id = om.user_id
           WHERE om.organization_id = $1 AND om.user_id = $3
             AND (om.role IN ('ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN') OR cm.user_id IS NOT NULL)
           LIMIT 1`,
          [request.params.organizationId, request.params.clinicId, request.body.userId],
        );
        if (!linkedUser.rowCount) {
          return reply.code(400).send({ error: { code: 'PROVIDER_USER_OUT_OF_SCOPE', message: 'Le compte sélectionné n’appartient pas à cette organisation ou clinique.' } });
        }
      }
      const result = await pool.query(
        `INSERT INTO clinic_providers (id, organization_id, clinic_id, user_id, display_name, role, color)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, display_name AS "displayName", role, color, user_id AS "userId", active`,
        [randomUUID(), request.params.organizationId, request.params.clinicId, request.body.userId ?? null,
          request.body.displayName.trim(), request.body.role, request.body.color ?? '#087f75'],
      );
      await pool.query(
        `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, 'CLINIC_PROVIDER_CREATED', 'CLINIC_PROVIDER', $4, $5::jsonb)`,
        [randomUUID(), request.params.organizationId, access.userId, result.rows[0].id,
          JSON.stringify({ clinicId: request.params.clinicId, role: request.body.role })],
      );
      return reply.code(201).send({ data: result.rows[0] });
    },
  );

  app.post<{ Params: ClinicParams; Body: CreateOperatoryBody }>(
    '/organizations/:organizationId/clinics/:clinicId/scheduling-resources/operatories',
    { schema: { body: operatorySchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return deny(reply);
      const result = await pool.query(
        `INSERT INTO clinic_operatories (id, organization_id, clinic_id, name, chair_number, color)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, chair_number AS "chairNumber", color, active`,
        [randomUUID(), request.params.organizationId, request.params.clinicId, request.body.name.trim(),
          request.body.chairNumber ?? null, request.body.color ?? '#267d93'],
      );
      await pool.query(
        `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, 'CLINIC_OPERATORY_CREATED', 'CLINIC_OPERATORY', $4, $5::jsonb)`,
        [randomUUID(), request.params.organizationId, access.userId, result.rows[0].id,
          JSON.stringify({ clinicId: request.params.clinicId, chairNumber: request.body.chairNumber ?? null })],
      );
      return reply.code(201).send({ data: result.rows[0] });
    },
  );

  app.put<{ Params: ProviderParams; Body: WorkingHoursBody }>(
    '/organizations/:organizationId/clinics/:clinicId/scheduling-resources/providers/:providerId/working-hours',
    { schema: { body: workingHoursSchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return deny(reply);
      if (request.body.endsAt <= request.body.startsAt) {
        return reply.code(400).send({ error: { code: 'INVALID_WORKING_HOURS', message: 'L’heure de fin doit être après l’heure de début.' } });
      }
      const provider = await pool.query(
        'SELECT id FROM clinic_providers WHERE organization_id = $1 AND clinic_id = $2 AND id = $3 AND active = true',
        [request.params.organizationId, request.params.clinicId, request.params.providerId],
      );
      if (!provider.rowCount) return reply.code(404).send({ error: { code: 'PROVIDER_NOT_FOUND', message: 'Praticien introuvable.' } });
      const result = await pool.query(
        `INSERT INTO provider_working_hours (id, organization_id, clinic_id, provider_id, day_of_week, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, $5, $6::time, $7::time)
         ON CONFLICT (organization_id, clinic_id, provider_id, day_of_week)
         DO UPDATE SET starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, updated_at = now()
         RETURNING day_of_week AS "dayOfWeek", to_char(starts_at, 'HH24:MI') AS "startsAt",
                   to_char(ends_at, 'HH24:MI') AS "endsAt"`,
        [randomUUID(), request.params.organizationId, request.params.clinicId, request.params.providerId,
          request.body.dayOfWeek, request.body.startsAt, request.body.endsAt],
      );
      await pool.query(
        `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, 'PROVIDER_WORKING_HOURS_UPDATED', 'CLINIC_PROVIDER', $4, $5::jsonb)`,
        [randomUUID(), request.params.organizationId, access.userId, request.params.providerId,
          JSON.stringify({ clinicId: request.params.clinicId, dayOfWeek: request.body.dayOfWeek,
            startsAt: request.body.startsAt, endsAt: request.body.endsAt })],
      );
      return { data: result.rows[0] };
    },
  );

  app.delete<{ Params: ProviderParams & { dayOfWeek: string } }>(
    '/organizations/:organizationId/clinics/:clinicId/scheduling-resources/providers/:providerId/working-hours/:dayOfWeek',
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return deny(reply);
      const dayOfWeek = Number(request.params.dayOfWeek);
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return reply.code(400).send({ error: { code: 'INVALID_WEEKDAY', message: 'Jour de semaine invalide.' } });
      }
      await pool.query(
        'DELETE FROM provider_working_hours WHERE organization_id = $1 AND clinic_id = $2 AND provider_id = $3 AND day_of_week = $4',
        [request.params.organizationId, request.params.clinicId, request.params.providerId, dayOfWeek],
      );
      await pool.query(
        `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, 'PROVIDER_WORKING_HOURS_REMOVED', 'CLINIC_PROVIDER', $4, $5::jsonb)`,
        [randomUUID(), request.params.organizationId, access.userId, request.params.providerId,
          JSON.stringify({ clinicId: request.params.clinicId, dayOfWeek })],
      );
      return reply.code(204).send();
    },
  );

};
 },
        },
      },
    },
  },
} as const;
interface BulkWorkingHoursBody { hours: WorkingHoursBody[]; }

export const schedulingResourceRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: ClinicParams }>('/organizations/:organizationId/clinics/:clinicId/scheduling-resources', async (request, reply) => {
    const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
    if (!access) return;
    if (!canManageAppointments(access.effectiveRole)) return deny(reply);

    const [providers, operatories] = await Promise.all([
      pool.query(
        `SELECT p.id, p.display_name AS "displayName", p.role, p.color, p.user_id AS "userId", p.active,
                COALESCE(jsonb_agg(jsonb_build_object(
                  'dayOfWeek', h.day_of_week,
                  'startsAt', to_char(h.starts_at, 'HH24:MI'),
                  'endsAt', to_char(h.ends_at, 'HH24:MI')
                ) ORDER BY h.day_of_week) FILTER (WHERE h.id IS NOT NULL), '[]'::jsonb) AS "workingHours"
         FROM clinic_providers p
         LEFT JOIN provider_working_hours h
           ON h.organization_id = p.organization_id AND h.clinic_id = p.clinic_id AND h.provider_id = p.id
         WHERE p.organization_id = $1 AND p.clinic_id = $2 AND p.active = true
         GROUP BY p.id ORDER BY p.display_name`,
        [request.params.organizationId, request.params.clinicId],
      ),
      pool.query(
        `SELECT id, name, chair_number AS "chairNumber", color, active
         FROM clinic_operatories WHERE organization_id = $1 AND clinic_id = $2 AND active = true
         ORDER BY chair_number NULLS LAST, name`,
        [request.params.organizationId, request.params.clinicId],
      ),
    ]);
    return { data: { providers: providers.rows, operatories: operatories.rows } };
  });

  app.post<{ Params: ClinicParams; Body: CreateProviderBody }>(
    '/organizations/:organizationId/clinics/:clinicId/scheduling-resources/providers',
    { schema: { body: providerSchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return deny(reply);
      if (request.body.userId) {
        const linkedUser = await pool.query(
          `SELECT 1
           FROM organization_memberships om
           LEFT JOIN clinic_memberships cm
             ON cm.organization_id = om.organization_id AND cm.clinic_id = $2 AND cm.user_id = om.user_id
           WHERE om.organization_id = $1 AND om.user_id = $3
             AND (om.role IN ('ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN') OR cm.user_id IS NOT NULL)
           LIMIT 1`,
          [request.params.organizationId, request.params.clinicId, request.body.userId],
        );
        if (!linkedUser.rowCount) {
          return reply.code(400).send({ error: { code: 'PROVIDER_USER_OUT_OF_SCOPE', message: 'Le compte sélectionné n’appartient pas à cette organisation ou clinique.' } });
        }
      }
      const result = await pool.query(
        `INSERT INTO clinic_providers (id, organization_id, clinic_id, user_id, display_name, role, color)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, display_name AS "displayName", role, color, user_id AS "userId", active`,
        [randomUUID(), request.params.organizationId, request.params.clinicId, request.body.userId ?? null,
          request.body.displayName.trim(), request.body.role, request.body.color ?? '#087f75'],
      );
      await pool.query(
        `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, 'CLINIC_PROVIDER_CREATED', 'CLINIC_PROVIDER', $4, $5::jsonb)`,
        [randomUUID(), request.params.organizationId, access.userId, result.rows[0].id,
          JSON.stringify({ clinicId: request.params.clinicId, role: request.body.role })],
      );
      return reply.code(201).send({ data: result.rows[0] });
    },
  );

  app.post<{ Params: ClinicParams; Body: CreateOperatoryBody }>(
    '/organizations/:organizationId/clinics/:clinicId/scheduling-resources/operatories',
    { schema: { body: operatorySchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return deny(reply);
      const result = await pool.query(
        `INSERT INTO clinic_operatories (id, organization_id, clinic_id, name, chair_number, color)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, chair_number AS "chairNumber", color, active`,
        [randomUUID(), request.params.organizationId, request.params.clinicId, request.body.name.trim(),
          request.body.chairNumber ?? null, request.body.color ?? '#267d93'],
      );
      await pool.query(
        `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, 'CLINIC_OPERATORY_CREATED', 'CLINIC_OPERATORY', $4, $5::jsonb)`,
        [randomUUID(), request.params.organizationId, access.userId, result.rows[0].id,
          JSON.stringify({ clinicId: request.params.clinicId, chairNumber: request.body.chairNumber ?? null })],
      );
      return reply.code(201).send({ data: result.rows[0] });
    },
  );

  app.put<{ Params: ProviderParams; Body: WorkingHoursBody }>(
    '/organizations/:organizationId/clinics/:clinicId/scheduling-resources/providers/:providerId/working-hours',
    { schema: { body: workingHoursSchema } },
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return deny(reply);
      if (request.body.endsAt <= request.body.startsAt) {
        return reply.code(400).send({ error: { code: 'INVALID_WORKING_HOURS', message: 'L’heure de fin doit être après l’heure de début.' } });
      }
      const provider = await pool.query(
        'SELECT id FROM clinic_providers WHERE organization_id = $1 AND clinic_id = $2 AND id = $3 AND active = true',
        [request.params.organizationId, request.params.clinicId, request.params.providerId],
      );
      if (!provider.rowCount) return reply.code(404).send({ error: { code: 'PROVIDER_NOT_FOUND', message: 'Praticien introuvable.' } });
      const result = await pool.query(
        `INSERT INTO provider_working_hours (id, organization_id, clinic_id, provider_id, day_of_week, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, $5, $6::time, $7::time)
         ON CONFLICT (organization_id, clinic_id, provider_id, day_of_week)
         DO UPDATE SET starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, updated_at = now()
         RETURNING day_of_week AS "dayOfWeek", to_char(starts_at, 'HH24:MI') AS "startsAt",
                   to_char(ends_at, 'HH24:MI') AS "endsAt"`,
        [randomUUID(), request.params.organizationId, request.params.clinicId, request.params.providerId,
          request.body.dayOfWeek, request.body.startsAt, request.body.endsAt],
      );
      await pool.query(
        `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, 'PROVIDER_WORKING_HOURS_UPDATED', 'CLINIC_PROVIDER', $4, $5::jsonb)`,
        [randomUUID(), request.params.organizationId, access.userId, request.params.providerId,
          JSON.stringify({ clinicId: request.params.clinicId, dayOfWeek: request.body.dayOfWeek,
            startsAt: request.body.startsAt, endsAt: request.body.endsAt })],
      );
      return { data: result.rows[0] };
    },
  );

  app.delete<{ Params: ProviderParams & { dayOfWeek: string } }>(
    '/organizations/:organizationId/clinics/:clinicId/scheduling-resources/providers/:providerId/working-hours/:dayOfWeek',
    async (request, reply) => {
      const access = await requireClinicAccess(request, reply, request.params.organizationId, request.params.clinicId);
      if (!access) return;
      if (!canManageAppointments(access.effectiveRole)) return deny(reply);
      const dayOfWeek = Number(request.params.dayOfWeek);
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return reply.code(400).send({ error: { code: 'INVALID_WEEKDAY', message: 'Jour de semaine invalide.' } });
      }
      await pool.query(
        'DELETE FROM provider_working_hours WHERE organization_id = $1 AND clinic_id = $2 AND provider_id = $3 AND day_of_week = $4',
        [request.params.organizationId, request.params.clinicId, request.params.providerId, dayOfWeek],
      );
      await pool.query(
        `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, 'PROVIDER_WORKING_HOURS_REMOVED', 'CLINIC_PROVIDER', $4, $5::jsonb)`,
        [randomUUID(), request.params.organizationId, access.userId, request.params.providerId,
          JSON.stringify({ clinicId: request.params.clinicId, dayOfWeek })],
      );
      return reply.code(204).send();
    },
  );

};
