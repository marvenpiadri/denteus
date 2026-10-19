import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.js';
import { pool } from '../db/pool.js';

interface Params { organizationId: string; }
interface MemberParams extends Params { userId: string; }
interface RoleBody { role: string; }

const organizationRoles = new Set([
  'ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN', 'CLINIC_ADMIN', 'DENTIST',
  'ORTHODONTIST', 'HYGIENIST', 'ASSISTANT', 'RECEPTIONIST', 'ACCOUNTANT',
]);
const roleSchema = {
  type: 'object', additionalProperties: false, required: ['role'],
  properties: { role: { type: 'string', enum: [...organizationRoles] } },
} as const;

export const organizationTeamRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: Params }>('/organizations/:organizationId/team', async (request, reply) => {
    const current = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!current) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });

    const access = await pool.query<{ role: string }>(
      'SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2',
      [request.params.organizationId, current.user.id],
    );
    if (!access.rowCount) return reply.code(404).send({ error: { code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' } });

    const canManage = ['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(access.rows[0].role);
    const result = await pool.query(
      `SELECT u.id AS "userId", u.name, u.email, om.role,
              om.created_at AS "joinedAt",
              (om.user_id = $2) AS "isCurrentUser",
              COALESCE(
                jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'role', cm.role)
                  ORDER BY c.name) FILTER (WHERE c.id IS NOT NULL),
                '[]'::jsonb
              ) AS clinics
       FROM organization_memberships om
       JOIN app_users u ON u.id = om.user_id
       LEFT JOIN clinic_memberships cm
         ON cm.organization_id = om.organization_id AND cm.user_id = om.user_id
       LEFT JOIN clinics c
         ON c.organization_id = cm.organization_id AND c.id = cm.clinic_id AND c.status = 'ACTIVE'
       WHERE om.organization_id = $1
       GROUP BY u.id, om.role, om.created_at, om.user_id
       ORDER BY CASE om.role WHEN 'ORGANIZATION_OWNER' THEN 0 WHEN 'ORGANIZATION_ADMIN' THEN 1 ELSE 2 END, u.name, u.email`,
      [request.params.organizationId, current.user.id],
    );
    return { data: result.rows, canManage, canManageOwners: access.rows[0].role === 'ORGANIZATION_OWNER' };
  });

  app.put<{ Params: MemberParams; Body: RoleBody }>(
    '/organizations/:organizationId/team/:userId',
    { schema: { body: roleSchema } },
    async (request, reply) => {
      const current = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!current) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });

      const { organizationId, userId } = request.params;
      const actor = await pool.query<{ role: string }>(
        'SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2',
        [organizationId, current.user.id],
      );
      if (!actor.rowCount) return reply.code(404).send({ error: { code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' } });
      const actorRole = actor.rows[0].role;
      if (!['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(actorRole)) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Only organization administrators can manage membership.' } });
      }
      const requestedRole = request.body.role;
      if (!organizationRoles.has(requestedRole)) {
        return reply.code(400).send({ error: { code: 'INVALID_ROLE', message: 'The requested organization role is invalid.' } });
      }
      if (requestedRole === 'ORGANIZATION_OWNER' && actorRole !== 'ORGANIZATION_OWNER') {
        return reply.code(403).send({ error: { code: 'OWNER_ROLE_PROTECTED', message: 'Only an organization owner can assign ownership.' } });
      }
      if (['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(requestedRole) && actorRole !== 'ORGANIZATION_OWNER') {
        return reply.code(403).send({ error: { code: 'ADMIN_ROLE_PROTECTED', message: 'Only an organization owner can assign organization administrator roles.' } });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [organizationId]);
        const lockedActor = await client.query<{ role: string }>(
          'SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 FOR UPDATE',
          [organizationId, current.user.id],
        );
        const effectiveActorRole = lockedActor.rows[0]?.role;
        if (!effectiveActorRole || !['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(effectiveActorRole)) {
          await client.query('ROLLBACK');
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Organization membership permissions changed. Refresh and try again.' } });
        }
        if (['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(requestedRole) && effectiveActorRole !== 'ORGANIZATION_OWNER') {
          await client.query('ROLLBACK');
          return reply.code(403).send({ error: { code: 'ADMIN_ROLE_PROTECTED', message: 'Only an organization owner can assign organization administrator roles.' } });
        }
        const target = await client.query<{ role: string }>(
          'SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 FOR UPDATE',
          [organizationId, userId],
        );
        if (!target.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'MEMBER_NOT_FOUND', message: 'Organization member not found.' } });
        }
        if (['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(target.rows[0].role) && effectiveActorRole !== 'ORGANIZATION_OWNER') {
          await client.query('ROLLBACK');
          return reply.code(403).send({ error: { code: 'ADMIN_ROLE_PROTECTED', message: 'Only an organization owner can change an organization owner or administrator.' } });
        }
        if (target.rows[0].role === 'ORGANIZATION_OWNER' && requestedRole !== 'ORGANIZATION_OWNER') {
          const owners = await client.query<{ count: number }>(
            "SELECT count(*)::integer AS count FROM organization_memberships WHERE organization_id = $1 AND role = 'ORGANIZATION_OWNER'",
            [organizationId],
          );
          if (owners.rows[0].count <= 1) {
            await client.query('ROLLBACK');
            return reply.code(409).send({ error: { code: 'LAST_ORGANIZATION_OWNER', message: 'The organization must retain at least one owner.' } });
          }
        }
        if (target.rows[0].role === requestedRole) {
          await client.query('COMMIT');
          return { data: { userId, role: requestedRole } };
        }
        const updated = await client.query<{ role: string }>(
          'UPDATE organization_memberships SET role = $3, updated_at = now() WHERE organization_id = $1 AND user_id = $2 RETURNING role',
          [organizationId, userId, requestedRole],
        );
        if (!['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(requestedRole)) {
          await client.query(
            'UPDATE clinic_memberships SET role = $3 WHERE organization_id = $1 AND user_id = $2',
            [organizationId, userId, requestedRole],
          );
        }
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, 'ORGANIZATION_MEMBER_ROLE_UPDATED', 'ORGANIZATION_MEMBERSHIP', $4, $5::jsonb)`,
          [randomUUID(), organizationId, current.user.id, userId, JSON.stringify({ previousRole: target.rows[0].role, role: requestedRole })],
        );
        await client.query('COMMIT');
        return { data: { userId, role: updated.rows[0].role } };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  );

  app.delete<{ Params: MemberParams }>(
    '/organizations/:organizationId/team/:userId',
    async (request, reply) => {
      const current = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!current) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });

      const { organizationId, userId } = request.params;
      const actor = await pool.query<{ role: string }>(
        'SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2',
        [organizationId, current.user.id],
      );
      if (!actor.rowCount) return reply.code(404).send({ error: { code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' } });
      if (!['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(actor.rows[0].role)) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Only organization administrators can remove members.' } });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [organizationId]);
        const lockedActor = await client.query<{ role: string }>(
          'SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 FOR UPDATE',
          [organizationId, current.user.id],
        );
        const effectiveActorRole = lockedActor.rows[0]?.role;
        if (!effectiveActorRole || !['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(effectiveActorRole)) {
          await client.query('ROLLBACK');
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Organization membership permissions changed. Refresh and try again.' } });
        }
        const target = await client.query<{ role: string }>(
          'SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 FOR UPDATE',
          [organizationId, userId],
        );
        if (!target.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'MEMBER_NOT_FOUND', message: 'Organization member not found.' } });
        }
        if (target.rows[0].role === 'ORGANIZATION_OWNER') {
          if (effectiveActorRole !== 'ORGANIZATION_OWNER') {
            await client.query('ROLLBACK');
            return reply.code(403).send({ error: { code: 'OWNER_ROLE_PROTECTED', message: 'Only an organization owner can remove an owner.' } });
          }
          const owners = await client.query<{ count: number }>(
            "SELECT count(*)::integer AS count FROM organization_memberships WHERE organization_id = $1 AND role = 'ORGANIZATION_OWNER'",
            [organizationId],
          );
          if (owners.rows[0].count <= 1) {
            await client.query('ROLLBACK');
            return reply.code(409).send({ error: { code: 'LAST_ORGANIZATION_OWNER', message: 'The organization must retain at least one owner.' } });
          }
        }
        if (target.rows[0].role === 'ORGANIZATION_ADMIN' && effectiveActorRole !== 'ORGANIZATION_OWNER') {
          await client.query('ROLLBACK');
          return reply.code(403).send({ error: { code: 'ADMIN_ROLE_PROTECTED', message: 'Only an organization owner can remove an organization administrator.' } });
        }
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, 'ORGANIZATION_MEMBER_REMOVED', 'ORGANIZATION_MEMBERSHIP', $4, $5::jsonb)`,
          [randomUUID(), organizationId, current.user.id, userId, JSON.stringify({ previousRole: target.rows[0].role })],
        );
        await client.query(
          'DELETE FROM organization_memberships WHERE organization_id = $1 AND user_id = $2',
          [organizationId, userId],
        );
        await client.query('COMMIT');
        return reply.code(204).send();
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  );
};
