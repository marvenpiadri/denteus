export interface ClinicRoleAccess {
  organizationRole: string;
  clinicRole: string | null;
  effectiveRole: string;
}

const organizationWideRoles = new Set(['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN']);

const patientManagers = new Set([
  'ORGANIZATION_OWNER',
  'ORGANIZATION_ADMIN',
  'CLINIC_ADMIN',
  'DENTIST',
  'ORTHODONTIST',
  'HYGIENIST',
  'ASSISTANT',
  'RECEPTIONIST',
]);

export function canManagePatients(access: ClinicRoleAccess): boolean {
  return patientManagers.has(access.effectiveRole);
}

export function canReadOdontogram(access: ClinicRoleAccess): boolean {
  return [
    'ORGANIZATION_OWNER',
    'ORGANIZATION_ADMIN',
    'CLINIC_ADMIN',
    'DENTIST',
    'ORTHODONTIST',
    'HYGIENIST',
    'ASSISTANT',
  ].includes(access.effectiveRole);
}

export function canWriteOdontogram(access: ClinicRoleAccess): boolean {
  return [
    'ORGANIZATION_OWNER',
    'ORGANIZATION_ADMIN',
    'CLINIC_ADMIN',
    'DENTIST',
    'ORTHODONTIST',
    'HYGIENIST',
  ].includes(access.effectiveRole);
}

export function isOrganizationWideRole(role: string): boolean {
  return organizationWideRoles.has(role);
}
