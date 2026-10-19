import { createHash } from 'node:crypto';

export const organizationInvitationRoles = [
  'ORGANIZATION_ADMIN', 'CLINIC_ADMIN', 'DENTIST', 'ORTHODONTIST',
  'HYGIENIST', 'ASSISTANT', 'RECEPTIONIST', 'ACCOUNTANT',
] as const;

export type OrganizationInvitationRole = typeof organizationInvitationRoles[number];

export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function canInviteOrganizationRole(actorRole: string, invitedRole: string): boolean {
  if (!['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'].includes(actorRole)) return false;
  if (invitedRole === 'ORGANIZATION_ADMIN') return actorRole === 'ORGANIZATION_OWNER';
  return organizationInvitationRoles.includes(invitedRole as OrganizationInvitationRole);
}

export function invitationNeedsClinicScope(role: string): boolean {
  return role !== 'ORGANIZATION_ADMIN';
}

export function isInvitationUsable(
  invitation: { expiresAt: Date | string; acceptedAt: Date | string | null; revokedAt: Date | string | null },
  now: Date = new Date(),
): boolean {
  return invitation.acceptedAt === null &&
    invitation.revokedAt === null &&
    new Date(invitation.expiresAt).getTime() > now.getTime();
}
