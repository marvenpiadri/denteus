import type { FastifyPluginAsync } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.js';
import { pool } from '../db/pool.js';

export const organizationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/organizations', async (request, reply) => {
    const current = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!current) {
      return reply.code(401).send({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
      });
    }

    const { rows } = await pool.query(
      `
        SELECT
          o.id,
          o.name,
          o.slug,
          o.currency,
          o.locale,
          om.role AS organization_role,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'timezone', c.timezone,
                'city', c.city,
                'role', COALESCE(cm.role, om.role)
              )
              ORDER BY c.name
            ) FILTER (WHERE c.id IS NOT NULL),
            '[]'::jsonb
          ) AS clinics
        FROM organization_memberships om
        JOIN organizations o ON o.id = om.organization_id
        LEFT JOIN clinics c
          ON c.organization_id = o.id
         AND c.status = 'ACTIVE'
         AND (
           om.role IN ('ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN')
           OR EXISTS (
             SELECT 1
             FROM clinic_memberships scoped_cm
             WHERE scoped_cm.clinic_id = c.id
               AND scoped_cm.user_id = om.user_id
           )
         )
        LEFT JOIN clinic_memberships cm
          ON cm.clinic_id = c.id
         AND cm.user_id = om.user_id
        WHERE om.user_id = $1
        GROUP BY o.id, om.role
        ORDER BY o.name
      `,
      [current.user.id],
    );

    return { data: rows };
  });
};
