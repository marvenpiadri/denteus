import { Injectable, computed, signal } from '@angular/core';
import { Clinic, Organization, User } from '../models/tenancy.models';

const INITIAL_ORGANIZATIONS: Organization[] = [
  {
    id: 'org-1',
    name: 'Clinique Dentaire Alami & Associés',
    slug: 'alami-dentaire',
    currency: 'MAD',
    defaultLocale: 'fr',
    subscriptionPlanId: 'plan-clinic',
    subscriptionStatus: 'active',
    trialEndsAt: '2026-10-31',
    createdAt: '2025-01-15',
  },
  {
    id: 'org-2',
    name: 'Centre de Spécialités Dentaires Marina',
    slug: 'marina-dental',
    currency: 'MAD',
    defaultLocale: 'fr',
    subscriptionPlanId: 'plan-group',
    subscriptionStatus: 'active',
    trialEndsAt: '2026-11-15',
    createdAt: '2025-06-01',
  },
];

const INITIAL_CLINICS: Clinic[] = [
  {
    id: 'clinic-1',
    organizationId: 'org-1',
    name: 'Cabinet Racine - Casablanca',
    slug: 'racine-casa',
    city: 'Casablanca',
    address: '42 Rue Jean Jaurès, Racine',
    phone: '+212 522 36 78 90',
    email: 'contact@cabinet-alami.ma',
    timezone: 'Africa/Casablanca',
    chairs: [
      { id: 'chair-1', clinicId: 'clinic-1', name: 'Fauteuil 1 (Chirurgie)', roomNumber: 'Salle A', status: 'active' },
      { id: 'chair-2', clinicId: 'clinic-1', name: 'Fauteuil 2 (Omnipratique)', roomNumber: 'Salle B', status: 'active' },
      { id: 'chair-3', clinicId: 'clinic-1', name: 'Fauteuil 3 (Hygiène & Soins)', roomNumber: 'Salle C', status: 'active' },
    ],
    openingHours: 'Lun - Ven: 08:30 - 19:00 | Sam: 09:00 - 13:00',
    status: 'active',
  },
  {
    id: 'clinic-2',
    organizationId: 'org-1',
    name: 'Cabinet Agdal - Rabat',
    slug: 'agdal-rabat',
    city: 'Rabat',
    address: '15 Avenue Fal Ould Oumeir, Agdal',
    phone: '+212 537 77 44 22',
    email: 'rabat@cabinet-alami.ma',
    timezone: 'Africa/Casablanca',
    chairs: [
      { id: 'chair-4', clinicId: 'clinic-2', name: 'Fauteuil Principal', roomNumber: 'Salle 1', status: 'active' },
      { id: 'chair-5', clinicId: 'clinic-2', name: 'Fauteuil Orthodontie', roomNumber: 'Salle 2', status: 'active' },
    ],
    openingHours: 'Lun - Ven: 09:00 - 18:30',
    status: 'active',
  },
  {
    id: 'clinic-3',
    organizationId: 'org-2',
    name: 'Marina Dental Hub - Tanger',
    slug: 'marina-tanger',
    city: 'Tanger',
    address: 'Boulevard Mohamed VI, Marina Bay',
    phone: '+212 539 94 11 00',
    email: 'info@marinadental.ma',
    timezone: 'Africa/Casablanca',
    chairs: [
      { id: 'chair-6', clinicId: 'clinic-3', name: 'Fauteuil Implanto', roomNumber: 'Suite 101', status: 'active' },
      { id: 'chair-7', clinicId: 'clinic-3', name: 'Fauteuil Esthétique', roomNumber: 'Suite 102', status: 'active' },
    ],
    openingHours: 'Lun - Sam: 09:00 - 20:00',
    status: 'active',
  },
];

const INITIAL_USERS: User[] = [
  {
    id: 'user-1',
    organizationId: 'org-1',
    clinicIds: ['clinic-1', 'clinic-2'],
    name: 'Dr. Youssef Alami',
    email: 'dr.alami@denteus.ma',
    phone: '+212 661 23 45 67',
    role: 'dentist',
    specialty: 'Chirurgien-Dentiste, Implantologie',
    color: '#0d9488', // Teal
    licenseNumber: 'ONCD-14892',
  },
  {
    id: 'user-2',
    organizationId: 'org-1',
    clinicIds: ['clinic-1'],
    name: 'Dr. Salma Berrada',
    email: 'dr.berrada@denteus.ma',
    phone: '+212 662 34 56 78',
    role: 'dentist',
    specialty: 'Endodontie & Parodontologie',
    color: '#3b82f6', // Blue
    licenseNumber: 'ONCD-16204',
  },
  {
    id: 'user-3',
    organizationId: 'org-1',
    clinicIds: ['clinic-1'],
    name: 'Kenza Bennani',
    email: 'kenza.reception@denteus.ma',
    phone: '+212 663 45 67 89',
    role: 'receptionist',
    color: '#8b5cf6', // Violet
  },
  {
    id: 'user-4',
    organizationId: 'org-1',
    clinicIds: ['clinic-1', 'clinic-2'],
    name: 'Nadia Mansouri',
    email: 'nadia.assistante@denteus.ma',
    phone: '+212 664 56 78 90',
    role: 'assistant',
    color: '#f59e0b', // Amber
  },
];

@Injectable({
  providedIn: 'root',
})
export class TenantService {
  readonly organizations = signal<Organization[]>(INITIAL_ORGANIZATIONS);
  readonly clinics = signal<Clinic[]>(INITIAL_CLINICS);
  readonly users = signal<User[]>(INITIAL_USERS);

  readonly currentOrganizationId = signal<string>('org-1');
  readonly currentClinicId = signal<string>('clinic-1');
  readonly currentUserId = signal<string>('user-1');

  readonly currentOrganization = computed(() => {
    return this.organizations().find((o) => o.id === this.currentOrganizationId()) || this.organizations()[0];
  });

  readonly availableClinics = computed(() => {
    return this.clinics().filter((c) => c.organizationId === this.currentOrganizationId());
  });

  readonly currentClinic = computed(() => {
    const list = this.availableClinics();
    return list.find((c) => c.id === this.currentClinicId()) || list[0];
  });

  readonly currentClinicChairs = computed(() => {
    return this.currentClinic()?.chairs || [];
  });

  readonly currentUser = computed(() => {
    return this.users().find((u) => u.id === this.currentUserId()) || this.users()[0];
  });

  readonly clinicDoctors = computed(() => {
    return this.users().filter(
      (u) =>
        u.organizationId === this.currentOrganizationId() &&
        (u.role === 'dentist' || u.role === 'orthodontist') &&
        u.clinicIds.includes(this.currentClinicId())
    );
  });

  switchOrganization(orgId: string): void {
    const org = this.organizations().find((o) => o.id === orgId);
    if (org) {
      this.currentOrganizationId.set(orgId);
      const clinicsForOrg = this.clinics().filter((c) => c.organizationId === orgId);
      if (clinicsForOrg.length > 0) {
        this.currentClinicId.set(clinicsForOrg[0].id);
      }
    }
  }

  switchClinic(clinicId: string): void {
    const clinic = this.clinics().find((c) => c.id === clinicId);
    if (clinic) {
      this.currentClinicId.set(clinicId);
    }
  }

  switchUser(userId: string): void {
    const user = this.users().find((u) => u.id === userId);
    if (user) {
      this.currentUserId.set(userId);
    }
  }

  hasPermission(action: string): boolean {
    const role = this.currentUser().role;
    if (role === 'organization_owner' || role === 'organization_admin') return true;
    if (role === 'clinic_admin') return action !== 'organization.manage';
    if (role === 'dentist' || role === 'orthodontist') {
      return !action.startsWith('organization.') && !action.startsWith('users.');
    }
    if (role === 'receptionist') {
      return (
        action.startsWith('patients.') ||
        action.startsWith('appointments.') ||
        action.startsWith('billing.')
      );
    }
    return action.startsWith('patients.read') || action.startsWith('appointments.read');
  }
}
