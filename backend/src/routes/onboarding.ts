import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.js';
import { pool } from '../db/pool.js';

interface CreateClinicBody {
  organizationName: string;
  organizationSlug: string;
  clinicName: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  currency?: string;
  locale?: string;
}

const createClinicSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['organizationName', 'organizationSlug', 'clinicName'],
  properties: {
    organizationName: { type: 'string', minLength: 2, maxLength: 120 },
    organizationSlug: {
      type: 'string',
      minLength: 3,
      maxLength: 60,
      pattern: '^[a-z0-9]+([a-z0-9-]*[a-z0-9])?$',
    },
    clinicName: { type: 'string', minLength: 2, maxLength: 120 },
    city: { type: 'string', maxLength: 120 },
    address: { type: 'string', maxLength: 500 },
    phone: { type: 'string', maxLength: 40 },
    email: { type: 'string', maxLength: 254 },
    timezone: { type: 'string', minLength: 1, maxLength: 100 },
    currency: { type: 'string', pattern: '^[A-Z]{3}$' },
    locale: { type: 'string', pattern: '^[a-z]{2}(-[A-Z]{2})?$' },
  },
} as const;

export const onboardingRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: CreateClinicBody }>(
    '/onboarding/clinic',
    { schema: { body: createClinicSchema } },
    async (request, reply) => {
      const current = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!current) {
        return reply.code(401).send({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
        });
      }

      const body = request.body;
      const organizationId = randomUUID();
      const clinicId = randomUUID();
      const client = await pool.connect();
      let transactionOpen = false;

      try {
        await client.query('BEGIN');
        transactionOpen = true;

        const organization = await client.query(
          `
            INSERT INTO organizations (id, name, slug, currency, locale)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (slug) DO NOTHING
            RETURNING id, name, slug, currency, locale
          `,
          [
            organizationId,
            body.organizationName.trim(),
            body.organizationSlug,
            body.currency ?? 'MAD',
            body.locale ?? 'fr',
          ],
        );

        if (!organization.rowCount) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return reply.code(409).send({
            error: {
              code: 'ORGANIZATION_SLUG_UNAVAILABLE',
              message: 'Ce nom d’adresse est déjà utilisé. Choisissez-en un autre.',
            },
          });
        }

        await client.query(
          `
            INSERT INTO organization_memberships (id, organization_id, user_id, role)
            VALUES ($1, $2, $3, 'ORGANIZATION_OWNER')
          `,
          [randomUUID(), organizationId, current.user.id],
        );

        await client.query(
          `
            INSERT INTO clinics (
              id, organization_id, name, city, address, phone, email, timezone
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            clinicId,
            organizationId,
            body.clinicName.trim(),
            body.city?.trim() || null,
            body.address?.trim() || null,
            body.phone?.trim() || null,
            body.email?.trim().toLowerCase() || null,
            body.timezone ?? 'Africa/Casablanca',
          ],
        );

        await client.query(
          `
            INSERT INTO clinic_memberships (
              id, organization_id, clinic_id, user_id, role
            )
            VALUES ($1, $2, $3, $4, 'ORGANIZATION_OWNER')
          `,
          [randomUUID(), organizationId, clinicId, current.user.id],
        );

        await client.query(
          `
            INSERT INTO audit_events (
              id, organization_id, user_id, action, resource_type, resource_id, metadata
            )
            VALUES ($1, $2, $3, 'CLINIC_ONBOARDED', 'CLINIC', $4, $5::jsonb)
          `,
          [
            randomUUID(),
            organizationId,
            current.user.id,
            clinicId,
            JSON.stringify({ organizationSlug: body.organizationSlug }),
          ],
        );

        await client.query('COMMIT');
        transactionOpen = false;

        return reply.code(201).send({
          data: {
            organization: organization.rows[0],
            clinic: {
              id: clinicId,
              organizationId,
              name: body.clinicName.trim(),
              city: body.city?.trim() || null,
              address: body.address?.trim() || null,
              phone: body.phone?.trim() || null,
              email: body.email?.trim().toLowerCase() || null,
              timezone: body.timezone ?? 'Africa/Casablanca',
              role: 'ORGANIZATION_OWNER',
            },
          },
        });
      } catch (error) {
        if (transactionOpen) await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  );
};
