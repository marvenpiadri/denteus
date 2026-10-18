import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface ClinicContext {
  id: string;
  name: string;
  role: string;
  timezone: string;
  city: string | null;
}

export interface OrganizationContext {
  id: string;
  name: string;
  slug: string;
  currency: string;
  locale: string;
  organization_role: string;
  clinics: ClinicContext[];
}

interface OrganizationsResponse {
  data: OrganizationContext[];
}

const ACTIVE_CLINIC_KEY = 'dentaleus.active-clinic';

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  readonly organizations = signal<OrganizationContext[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly activeClinicId = signal<string | null>(this.readSavedClinicId());
  readonly clinics = computed(() => this.organizations().flatMap((organization) =>
    organization.clinics.map((clinic) => ({
      ...clinic,
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      currency: organization.currency,
      locale: organization.locale,
    })),
  ));
  readonly activeClinic = computed(() =>
    this.clinics().find((clinic) => clinic.id === this.activeClinicId()) ?? this.clinics()[0] ?? null,
  );

  async load(force = false): Promise<void> {
    if (this.loading()) return;
    if (!force && this.organizations().length) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(
        this.http.get<OrganizationsResponse>('/api/v1/organizations', { withCredentials: true }),
      );
      this.organizations.set(response.data);
      const clinics = response.data.flatMap((organization) => organization.clinics);
      if (!clinics.some((clinic) => clinic.id === this.activeClinicId())) {
        this.setActiveClinic(clinics[0]?.id ?? null);
      }
    } catch (error) {
      this.organizations.set([]);
      this.error.set(error instanceof HttpErrorResponse && error.status === 401
        ? 'Votre session a expiré. Reconnectez-vous pour continuer.'
        : 'Impossible de charger les cliniques autorisées. Réessayez.');
    } finally {
      this.loading.set(false);
    }
  }

  setActiveClinic(clinicId: string | null): void {
    this.activeClinicId.set(clinicId);
    if (isPlatformBrowser(this.platformId)) {
      try {
        if (clinicId) localStorage.setItem(ACTIVE_CLINIC_KEY, clinicId);
        else localStorage.removeItem(ACTIVE_CLINIC_KEY);
      } catch {
        // Clinic selection still works in memory when browser storage is unavailable.
      }
    }
  }

  private readSavedClinicId(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      return localStorage.getItem(ACTIVE_CLINIC_KEY);
    } catch {
      return null;
    }
  }
}
