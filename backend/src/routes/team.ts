import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { requireClinicAccess } from '../auth/authorization.js';
import { pool } from '../db/pool.js';

interface Params { organizationId: string; clinicId: string; }
interface MemberParams extends Params { userId: string; }
interface MembershipBody { userId: string; role: string; }
interface RoleBody { role: string; }

const clinicRoles = new Set(['CLINIC_ADMIN', 'DENTIST', 'ORTHODONTIST', 'HYGIENIST', 'ASSISTANT', 'RECEPTIONIST']);
const adminRoles = new Set(['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN', 'CLINIC_ADMIN']);
const membershipSchema = {
  type: 'object', additionalProperties: false, required: ['userId', 'role'],
  properties: {
    userId: { type: 'string', minLength: 1, maxLength: 100 },
    role: { type: 'string', enum: ['CLINIC_ADMIN', 'DENTIST', 'ORTHODONTIST', 'HYGIENIST', 'ASSISTANT', 'RECEPTIONIST'] },
  },
} as const;
const roleSchema = {
  type: 'object', additionalProperties: false, required: ['role'],
  properties: {
    role: { type: 'string', enum: ['CLINIC_ADMIN', 'DENTIST', 'ORTHODONTIST', 'HYGIENIST', 'ASSISTANT', 'RECEPTIONIST'] },
  },
} as const;

export const teamRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: Params }>('/organizations/:organizationId/clinics/:clinicId/team', async (request, reply) => {
    const { organizationId, clinicId } = request.params;
    const access = await requireClinicAccess(request, reply, organizationId, clinicId);
    if (!access) return;
    const canManage = adminRoles.has(access.effectiveRole);
    const result = await pool.query(
      `SELECT u.id AS "userId", u.name, u.email,
              om.role AS "organizationRole", cm.role AS "clinicRole",
              CASE WHEN om.role IN ('ORGANIZATION_OWNER','ORGANIZATION_ADMIN')
                   THEN om.role ELSE COALESCE(cm.role, om.role) END AS "effectiveRole"
       FROM organization_memberships om
       JOIN app_users u ON u.id = om.user_id
       LEFT JOIN clinic_memberships cm
         ON cm.organization_id = om.organization_id AND cm.clinic_id = $2 AND cm.user_id = om.user_id
       WHERE om.organization_id = $1
       ORDER BY (cm.user_id IS NOT NULL) DESC, u.name, u.email`,
      [organizationId, clinicId],
    );
    return { data: result.rows, canManage };
  });

  app.post<{ Params: Params; Body: MembershipBody }>(
    '/organizations/:organizationId/clinics/:clinicId/team',
    { schema: { body: membershipSchema } },
    async (request, reply) => {
      const { organizationId, clinicId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!adminRoles.has(access.effectiveRole)) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Seuls les administrateurs peuvent gérer les accès de la clinique.' } });
      }
      if (!clinicRoles.has(request.body.role)) {
        return reply.code(400).send({ error: { code: 'INVALID_CLINIC_ROLE', message: 'Rôle de clinique non valide.' } });
      }
      const user = await pool.query(
        'SELECT id FROM organization_memberships WHERE organization_id = $1 AND user_id = $2',
        [organizationId, request.body.userId],
      );
      if (!user.rowCount) {
        return reply.code(404).send({ error: { code: 'MEMBER_NOT_FOUND', message: 'Ce compte ne fait pas partie de l’organisation.' } });
      }
      const existing = await pool.query(
        'SELECT 1 FROM clinic_memberships WHERE organization_id = $1 AND clinic_id = $2 AND user_id = $3',
        [organizationId, clinicId, request.body.userId],
      );
      if (existing.rowCount) {
        return reply.code(409).send({ error: { code: 'MEMBERSHIP_EXISTS', message: 'Ce membre possède déjà un accès à cette clinique.' } });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO clinic_memberships (id, organization_id, clinic_id, user_id, role)
           VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), organizationId, clinicId, request.body.userId, request.body.role],
        );
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, 'CLINIC_MEMBER_ADDED', 'CLINIC_MEMBERSHIP', $4, $5::jsonb)`,
          [randomUUID(), organizationId, access.userId, request.body.userId, JSON.stringify({ clinicId, role: request.body.role })],
        );
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
      return reply.code(201).send({ data: { userId: request.body.userId, role: request.body.role } });
    },
  );

  app.put<{ Params: MemberParams; Body: RoleBody }>(
    '/organizations/:organizationId/clinics/:clinicId/team/:userId',
    { schema: { body: roleSchema } },
    async (request, reply) => {
      const { organizationId, clinicId, userId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!adminRoles.has(access.effectiveRole)) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Seuls les administrateurs peuvent modifier les accès.' } });
      }
      if (!clinicRoles.has(request.body.role)) {
        return reply.code(400).send({ error: { code: 'INVALID_CLINIC_ROLE', message: 'Rôle de clinique non valide.' } });
      }
      const target = await pool.query<{ organization_role: string }>(
        'SELECT role AS organization_role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2',
        [organizationId, userId],
      );
      if (!target.rowCount) return reply.code(404).send({ error: { code: 'MEMBER_NOT_FOUND', message: 'Membre introuvable.' } });
      if (['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(target.rows[0].organization_role)) {
        return reply.code(409).send({ error: { code: 'ORGANIZATION_ROLE_PROTECTED', message: 'Les rôles attribués au niveau de l’organisation ne se modifient pas depuis une clinique.' } });
      }
      const currentMembership = await pool.query<{ role: string }>(
        'SELECT role FROM clinic_memberships WHERE organization_id = $1 AND clinic_id = $2 AND user_id = $3',
        [organizationId, clinicId, userId],
      );
      if (!currentMembership.rowCount) return reply.code(404).send({ error: { code: 'MEMBERSHIP_NOT_FOUND', message: 'Ce membre n’a pas accès à cette clinique.' } });
      if (currentMembership.rows[0].role === 'CLINIC_ADMIN' && request.body.role !== 'CLINIC_ADMIN') {
        const admins = await pool.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM clinic_memberships WHERE organization_id = $1 AND clinic_id = $2 AND role = 'CLINIC_ADMIN'",
          [organizationId, clinicId],
        );
        if (admins.rows[0].count <= 1) {
          return reply.code(409).send({ error: { code: 'LAST_CLINIC_ADMIN', message: 'La clinique doit conserver au moins un administrateur.' } });
        }
      }
      const client = await pool.connect();
      let updatedMember: { userId: string; role: string } | undefined;
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [organizationId, clinicId]);
        const lockedMembership = await client.query<{ role: string }>(
          'SELECT role FROM clinic_memberships WHERE organization_id = $1 AND clinic_id = $2 AND user_id = $3 FOR UPDATE',
          [organizationId, clinicId, userId],
        );
        if (!lockedMembership.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'MEMBERSHIP_NOT_FOUND', message: 'Ce membre n’a pas accès à cette clinique.' } });
        }
        if (lockedMembership.rows[0].role === 'CLINIC_ADMIN' && request.body.role !== 'CLINIC_ADMIN') {
          const admins = await client.query<{ count: number }>(
            "SELECT count(*)::integer AS count FROM clinic_memberships WHERE organization_id = $1 AND clinic_id = $2 AND role = 'CLINIC_ADMIN'",
            [organizationId, clinicId],
          );
          if (admins.rows[0].count <= 1) {
            await client.query('ROLLBACK');
            return reply.code(409).send({ error: { code: 'LAST_CLINIC_ADMIN', message: 'La clinique doit conserver au moins un administrateur.' } });
          }
        }
        const result = await client.query<{ userId: string; role: string }>(
          `UPDATE clinic_memberships SET role = $4
           WHERE organization_id = $1 AND clinic_id = $2 AND user_id = $3
           RETURNING user_id AS "userId", role`,
          [organizationId, clinicId, userId, request.body.role],
        );
        if (!result.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'MEMBERSHIP_NOT_FOUND', message: 'Ce membre n’a pas accès à cette clinique.' } });
        }
        updatedMember = result.rows[0];
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, 'CLINIC_MEMBER_ROLE_UPDATED', 'CLINIC_MEMBERSHIP', $4, $5::jsonb)`,
          [randomUUID(), organizationId, access.userId, userId, JSON.stringify({ clinicId, role: request.body.role })],
        );
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
      return { data: updatedMember };
    },
  );

  app.delete<{ Params: MemberParams }>(
    '/organizations/:organizationId/clinics/:clinicId/team/:userId',
    async (request, reply) => {
      const { organizationId, clinicId, userId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;
      if (!adminRoles.has(access.effectiveRole)) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Seuls les administrateurs peuvent retirer un accès.' } });
      }
      const target = await pool.query<{ organization_role: string }>(
        'SELECT role AS organization_role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2',
        [organizationId, userId],
      );
      if (!target.rowCount) return reply.code(404).send({ error: { code: 'MEMBER_NOT_FOUND', message: 'Membre introuvable.' } });
      if (['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(target.rows[0].organization_role)) {
        return reply.code(409).send({ error: { code: 'ORGANIZATION_ROLE_PROTECTED', message: 'Un administrateur de l’organisation doit être géré au niveau de l’organisation.' } });
      }
      const currentMembership = await pool.query<{ role: string }>(
        'SELECT role FROM clinic_memberships WHERE organization_id = $1 AND clinic_id = $2 AND user_id = $3',
        [organizationId, clinicId, userId],
      );
      if (!currentMembership.rowCount) return reply.code(404).send({ error: { code: 'MEMBERSHIP_NOT_FOUND', message: 'Ce membre n’a pas accès à cette clinique.' } });
      if (currentMembership.rows[0].role === 'CLINIC_ADMIN') {
        const admins = await pool.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM clinic_memberships WHERE organization_id = $1 AND clinic_id = $2 AND role = 'CLINIC_ADMIN'",
          [organizationId, clinicId],
        );
        if (admins.rows[0].count <= 1) {
          return reply.code(409).send({ error: { code: 'LAST_CLINIC_ADMIN', message: 'La clinique doit conserver au moins un administrateur.' } });
        }
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [organizationId, clinicId]);
        const lockedMembership = await client.query<{ role: string }>(
          'SELECT role FROM clinic_memberships WHERE organization_id = $1 AND clinic_id = $2 AND user_id = $3 FOR UPDATE',
          [organizationId, clinicId, userId],
        );
        if (!lockedMembership.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'MEMBERSHIP_NOT_FOUND', message: 'Ce membre n’a pas accès à cette clinique.' } });
        }
        if (lockedMembership.rows[0].role === 'CLINIC_ADMIN') {
          const admins = await client.query<{ count: number }>(
            "SELECT count(*)::integer AS count FROM clinic_memberships WHERE organization_id = $1 AND clinic_id = $2 AND role = 'CLINIC_ADMIN'",
            [organizationId, clinicId],
          );
          if (admins.rows[0].count <= 1) {
            await client.query('ROLLBACK');
            return reply.code(409).send({ error: { code: 'LAST_CLINIC_ADMIN', message: 'La clinique doit conserver au moins un administrateur.' } });
          }
        }
        const removed = await client.query(
          'DELETE FROM clinic_memberships WHERE organization_id = $1 AND clinic_id = $2 AND user_id = $3 RETURNING user_id',
          [organizationId, clinicId, userId],
        );
        if (!removed.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'MEMBERSHIP_NOT_FOUND', message: 'Ce membre n’a pas accès à cette clinique.' } });
        }
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, 'CLINIC_MEMBER_REMOVED', 'CLINIC_MEMBERSHIP', $4, $5::jsonb)`,
          [randomUUID(), organizationId, access.userId, userId, JSON.stringify({ clinicId })],
        );
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
      return reply.code(204).send();
    },
  );
};
