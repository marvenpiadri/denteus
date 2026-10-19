import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { auth } from './auth.js';
import { pool } from '../db/pool.js';

import { isOrganizationWideRole } from './role-policy.js';

export { canManagePatients, canReadOdontogram, canWriteOdontogram } from './role-policy.js';

export interface ClinicAccess {
  userId: string;
  organizationRole: string;
  clinicRole: string | null;
  effectiveRole: string;
}

export async function requireClinicAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  organizationId: string,
  clinicId: string,
): Promise<ClinicAccess | null> {
  const current = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!current) {
    reply.code(401).send({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
    });
    return null;
  }

  const result = await pool.query<{
    organization_role: string;
    clinic_role: string | null;
  }>(
    `
      SELECT om.role AS organization_role, cm.role AS clinic_role
      FROM clinics c
      JOIN organization_memberships om
        ON om.organization_id = c.organization_id
       AND om.user_id = $1
      LEFT JOIN clinic_memberships cm
        ON cm.organization_id = c.organization_id
       AND cm.clinic_id = c.id
       AND cm.user_id = $1
      WHERE c.organization_id = $2
        AND c.id = $3
        AND c.status = 'ACTIVE'
        AND (
          om.role IN ('ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN')
          OR cm.user_id IS NOT NULL
        )
      LIMIT 1
    `,
    [current.user.id, organizationId, clinicId],
  );

  const membership = result.rows[0];
  if (!membership) {
    // Deliberately do not reveal whether the organization or clinic exists.
    reply.code(404).send({
      error: { code: 'CLINIC_NOT_FOUND', message: 'Clinic not found.' },
    });
    return null;
  }

  const effectiveRole = isOrganizationWideRole(membership.organization_role)
    ? membership.organization_role
    : membership.clinic_role ?? membership.organization_role;

  return {
    userId: current.user.id,
    organizationRole: membership.organization_role,
    clinicRole: membership.clinic_role,
    effectiveRole,
  };
}

export async function hasActiveClinicalProvider(
  organizationId: string,
  clinicId: string,
  userId: string,
  roles: readonly string[],
): Promise<boolean> {
  if (!roles.length) return false;
  const result = await pool.query(
    `SELECT 1 FROM clinic_providers
     WHERE organization_id=$1 AND clinic_id=$2 AND user_id=$3 AND active=true AND role = ANY($4::text[])
     LIMIT 1`,
    [organizationId, clinicId, userId, roles],
  );
  return Boolean(result.rowCount);
}

export function denyInsufficientRole(reply: FastifyReply): null {
  reply.code(403).send({
    error: { code: 'FORBIDDEN', message: 'Your role does not permit this action.' },
  });
  return null;
}
