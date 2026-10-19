import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.js';
import { pool } from '../db/pool.js';
import { canInviteOrganizationRole, hashInvitationToken, invitationNeedsClinicScope, isInvitationUsable, normalizeInvitationEmail, organizationInvitationRoles, type OrganizationInvitationRole } from '../domain/organization-invitation-policy.js';

interface OrganizationParams { organizationId: string; }
interface InvitationParams extends OrganizationParams { invitationId: string; }
interface CreateInvitationBody { email: string; role: string; clinicIds?: string[]; }
interface AcceptInvitationBody { token: string; }

const createSchema = {
  type: 'object', additionalProperties: false, required: ['email', 'role'],
  properties: {
    email: { type: 'string', format: 'email', minLength: 3, maxLength: 254 },
    role: { type: 'string', enum: organizationInvitationRoles },
    clinicIds: { type: 'array', uniqueItems: true, maxItems: 100, items: { type: 'string', minLength: 1, maxLength: 100 } },
  },
} as const;
const acceptSchema = {
  type: 'object', additionalProperties: false, required: ['token'],
  properties: { token: { type: 'string', minLength: 32, maxLength: 200 } },
} as const;

export const organizationInvitationRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: OrganizationParams }>('/organizations/:organizationId/invitations', async (request, reply) => {
    const current = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!current) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    const access = await pool.query<{ role: string }>(
      'SELECT role FROM organization_memberships WHERE organization_id=$1 AND user_id=$2',
      [request.params.organizationId, current.user.id],
    );
    if (!access.rowCount) return reply.code(404).send({ error: { code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' } });
    if (!['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(access.rows[0].role)) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Only organization administrators can view invitations.' } });
    }
    const result = await pool.query(
      `SELECT i.id, i.invited_email AS "email", i.role, i.clinic_ids AS "clinicIds",
              i.expires_at AS "expiresAt", i.accepted_at AS "acceptedAt",
              i.revoked_at AS "revokedAt", i.created_at AS "createdAt",
              u.name AS "invitedByName",
              CASE WHEN i.revoked_at IS NOT NULL THEN 'REVOKED'
                   WHEN i.accepted_at IS NOT NULL THEN 'ACCEPTED'
                   WHEN i.expires_at <= now() THEN 'EXPIRED'
                   ELSE 'PENDING' END AS status
       FROM organization_invitations i
       LEFT JOIN app_users u ON u.id=i.invited_by_id
       WHERE i.organization_id=$1
       ORDER BY i.created_at DESC LIMIT 100`,
      [request.params.organizationId],
    );
    return { data: result.rows };
  });

  app.post<{ Params: OrganizationParams; Body: CreateInvitationBody }>(
    '/organizations/:organizationId/invitations',
    { schema: { body: createSchema } },
    async (request, reply) => {
      const current = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!current) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
      const { organizationId } = request.params;
      const actor = await pool.query<{ role: string }>(
        'SELECT role FROM organization_memberships WHERE organization_id=$1 AND user_id=$2',
        [organizationId, current.user.id],
      );
      if (!actor.rowCount) return reply.code(404).send({ error: { code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' } });
      if (!['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(actor.rows[0].role)) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Only organization administrators can invite members.' } });
      }
      const email = normalizeInvitationEmail(request.body.email);
      const role = request.body.role;
      if (!organizationInvitationRoles.includes(role as OrganizationInvitationRole)) {
        return reply.code(400).send({ error: { code: 'INVALID_ROLE', message: 'The requested invitation role is invalid.' } });
      }
      if (!canInviteOrganizationRole(actor.rows[0].role, role)) {
        return reply.code(403).send({ error: { code: 'ADMIN_ROLE_PROTECTED', message: 'Only an organization owner can invite an organization administrator.' } });
      }
      const existing = await pool.query(
        'SELECT 1 FROM app_users u JOIN organization_memberships om ON om.user_id=u.id WHERE om.organization_id=$1 AND lower(u.email)=lower($2)',
        [organizationId, email],
      );
      if (existing.rowCount) return reply.code(409).send({ error: { code: 'ALREADY_MEMBER', message: 'This person is already a member of the organization.' } });

      const clinicIds = [...new Set(request.body.clinicIds ?? [])];
      if (invitationNeedsClinicScope(role) && clinicIds.length === 0) {
        return reply.code(400).send({ error: { code: 'CLINIC_SCOPE_REQUIRED', message: 'Select at least one clinic for this staff role.' } });
      }
      if (clinicIds.length) {
        const clinics = await pool.query(
          "SELECT id FROM clinics WHERE organization_id=$1 AND status='ACTIVE' AND id=ANY($2::text[])",
          [organizationId, clinicIds],
        );
        if (clinics.rowCount !== clinicIds.length) {
          return reply.code(400).send({ error: { code: 'INVALID_CLINIC_SCOPE', message: 'One or more selected clinics do not belong to this active organization.' } });
        }
      }
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      try {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [organizationId]);
          const lockedActor = await client.query<{ role: string }>(
            'SELECT role FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 FOR UPDATE',
            [organizationId, current.user.id],
          );
          if (!lockedActor.rowCount || !canInviteOrganizationRole(lockedActor.rows[0].role, role)) {
            await client.query('ROLLBACK');
            return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Your invitation permissions changed. Refresh and try again.' } });
          }
          const memberCheck = await client.query(
            'SELECT 1 FROM app_users u JOIN organization_memberships om ON om.user_id=u.id WHERE om.organization_id=$1 AND lower(u.email)=lower($2)',
            [organizationId, email],
          );
          if (memberCheck.rowCount) {
            await client.query('ROLLBACK');
            return reply.code(409).send({ error: { code: 'ALREADY_MEMBER', message: 'This person is already a member of the organization.' } });
          }
          await client.query(
            `UPDATE organization_invitations
             SET revoked_at=now()
             WHERE organization_id=$1 AND invited_email=$2
               AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at<=now()`,
            [organizationId, email],
          );
          const inserted = await client.query(
            `INSERT INTO organization_invitations
             (id, organization_id, invited_email, role, clinic_ids, token_hash, invited_by_id, expires_at)
             VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)
             RETURNING id, expires_at AS "expiresAt"`,
            [randomUUID(), organizationId, email, role, JSON.stringify(clinicIds), hashInvitationToken(token), current.user.id, expiresAt],
          );
          await client.query(
            `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
             VALUES ($1,$2,$3,'ORGANIZATION_INVITATION_CREATED','ORGANIZATION_INVITATION',$4,$5::jsonb)`,
            [randomUUID(), organizationId, current.user.id, inserted.rows[0].id, JSON.stringify({ email, role, clinicIds, expiresAt })],
          );
          await client.query('COMMIT');
          return reply.code(201).send({ data: { id: inserted.rows[0].id, email, role, clinicIds, expiresAt: inserted.rows[0].expiresAt, token } });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally { client.release(); }
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
          return reply.code(409).send({ error: { code: 'INVITATION_PENDING', message: 'An active invitation already exists for this email. Revoke it before creating another.' } });
        }
        throw error;
      }
    },
  );

  app.delete<{ Params: InvitationParams }>(
    '/organizations/:organizationId/invitations/:invitationId',
    async (request, reply) => {
      const current = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!current) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
      const { organizationId, invitationId } = request.params;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [organizationId]);
        const actor = await client.query<{ role: string }>(
          'SELECT role FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 FOR UPDATE',
          [organizationId, current.user.id],
        );
        if (!actor.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' } });
        }
        if (!['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(actor.rows[0].role)) {
          await client.query('ROLLBACK');
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Only organization administrators can revoke invitations.' } });
        }
        const revoked = await client.query(
          `UPDATE organization_invitations SET revoked_at=now()
           WHERE organization_id=$1 AND id=$2 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()
           RETURNING id`,
          [organizationId, invitationId],
        );
        if (!revoked.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: { code: 'INVITATION_NOT_FOUND', message: 'No pending invitation was found.' } });
        }
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1,$2,$3,'ORGANIZATION_INVITATION_REVOKED','ORGANIZATION_INVITATION',$4,'{}'::jsonb)`,
          [randomUUID(), organizationId, current.user.id, invitationId],
        );
        await client.query('COMMIT');
        return reply.code(204).send();
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  );

  app.post<{ Body: AcceptInvitationBody }>(
    '/organization-invitations/accept',
    { schema: { body: acceptSchema } },
    async (request, reply) => {
      const current = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!current) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Sign in with the invited email address to accept this invitation.' } });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tokenHash = hashInvitationToken(request.body.token);
        const invitationScope = await client.query<{ organization_id: string }>(
          'SELECT organization_id FROM organization_invitations WHERE token_hash=$1',
          [tokenHash],
        );
        if (!invitationScope.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(410).send({ error: { code: 'INVITATION_INVALID', message: 'This invitation is expired, revoked, or already used.' } });
        }
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [invitationScope.rows[0].organization_id]);
        const invitation = await client.query<{
          id: string; organization_id: string; invited_email: string; role: string;
          clinic_ids: string[]; expires_at: Date; accepted_at: Date | null; revoked_at: Date | null;
        }>(
          `SELECT id, organization_id, invited_email, role, clinic_ids, expires_at, accepted_at, revoked_at
           FROM organization_invitations WHERE token_hash=$1 FOR UPDATE`,
          [tokenHash],
        );
        const invite = invitation.rows[0];
        if (!invite || !isInvitationUsable({ expiresAt: invite.expires_at, acceptedAt: invite.accepted_at, revokedAt: invite.revoked_at })) {
          await client.query('ROLLBACK');
          return reply.code(410).send({ error: { code: 'INVITATION_INVALID', message: 'This invitation is expired, revoked, or already used.' } });
        }
        if (current.user.email.trim().toLowerCase() !== invite.invited_email) {
          await client.query('ROLLBACK');
          return reply.code(403).send({ error: { code: 'INVITATION_EMAIL_MISMATCH', message: 'Sign in with the email address this invitation was sent to.' } });
        }
        const existing = await client.query(
          'SELECT 1 FROM organization_memberships WHERE organization_id=$1 AND user_id=$2',
          [invite.organization_id, current.user.id],
        );
        if (existing.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: { code: 'ALREADY_MEMBER', message: 'Your account is already a member of this organization.' } });
        }
        const organization = await client.query<{ name: string }>(
          'SELECT name FROM organizations WHERE id=$1',
          [invite.organization_id],
        );
        if (!organization.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(410).send({ error: { code: 'ORGANIZATION_UNAVAILABLE', message: 'This organization is no longer available.' } });
        }
        await client.query(
          'INSERT INTO organization_memberships (id, organization_id, user_id, role) VALUES ($1,$2,$3,$4)',
          [randomUUID(), invite.organization_id, current.user.id, invite.role],
        );
        const clinicIds = Array.isArray(invite.clinic_ids) ? invite.clinic_ids : [];
        if (clinicIds.length) {
          const clinics = await client.query<{ id: string }>(
            "SELECT id FROM clinics WHERE organization_id=$1 AND status='ACTIVE' AND id=ANY($2::text[])",
            [invite.organization_id, clinicIds],
          );
          if (clinics.rowCount !== clinicIds.length) {
            await client.query('ROLLBACK');
            return reply.code(409).send({ error: { code: 'INVITATION_SCOPE_CHANGED', message: 'One or more invited clinics are no longer active. Ask the administrator for a new invitation.' } });
          }
          for (const clinic of clinics.rows) {
            await client.query(
              'INSERT INTO clinic_memberships (id, organization_id, clinic_id, user_id, role) VALUES ($1,$2,$3,$4,$5)',
              [randomUUID(), invite.organization_id, clinic.id, current.user.id, invite.role === 'ORGANIZATION_ADMIN' ? 'CLINIC_ADMIN' : invite.role],
            );
          }
        }
        await client.query(
          'UPDATE organization_invitations SET accepted_at=now(), accepted_by_id=$2 WHERE id=$1',
          [invite.id, current.user.id],
        );
        await client.query(
          `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1,$2,$3,'ORGANIZATION_INVITATION_ACCEPTED','ORGANIZATION_INVITATION',$4,$5::jsonb)`,
          [randomUUID(), invite.organization_id, current.user.id, invite.id, JSON.stringify({ role: invite.role, clinicIds })],
        );
        await client.query('COMMIT');
        return { data: { organizationId: invite.organization_id, organizationName: organization.rows[0].name, role: invite.role } };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  );
};
