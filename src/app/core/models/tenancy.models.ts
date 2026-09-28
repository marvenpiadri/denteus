export type UserRole =
  | 'organization_owner'
  | 'organization_admin'
  | 'clinic_admin'
  | 'dentist'
  | 'orthodontist'
  | 'hygienist'
  | 'assistant'
  | 'receptionist'
  | 'accountant';

export interface UserPermission {
  action: string;
  subject: string;
}

export interface User {
  id: string;
  organizationId: string;
  clinicIds: string[];
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  specialty?: string;
  color: string;
  avatar?: string;
  licenseNumber?: string;
}

export interface ClinicChair {
  id: string;
  clinicId: string;
  name: string;
  roomNumber: string;
  status: 'active' | 'maintenance' | 'inactive';
}

export interface Clinic {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  chairs: ClinicChair[];
  openingHours: string;
  status: 'active' | 'inactive';
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  currency: 'MAD' | 'EUR' | 'USD';
  defaultLocale: 'fr' | 'en' | 'ar';
  subscriptionPlanId: string;
  subscriptionStatus: 'trial' | 'active' | 'past_due' | 'cancelled';
  trialEndsAt: string;
  createdAt: string;
}
