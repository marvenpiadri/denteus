import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type ProviderRole = 'DENTIST' | 'ORTHODONTIST' | 'HYGIENIST' | 'ASSISTANT' | 'SPECIALIST';
export interface ProviderWorkingHour {
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
}
export interface ClinicProvider {
  id: string;
  displayName: string;
  role: ProviderRole;
  color: string;
  userId: string | null;
  active: boolean;
  workingHours: ProviderWorkingHour[];
}
export interface ClinicOperatory {
  id: string;
  name: string;
  chairNumber: number | null;
  color: string;
  active: boolean;
}
export interface SchedulingResources {
  providers: ClinicProvider[];
  operatories: ClinicOperatory[];
}

@Injectable({ providedIn: 'root' })
export class SchedulingResourceApiService {
  private readonly http = inject(HttpClient);

  async list(organizationId: string, clinicId: string): Promise<SchedulingResources> {
    const response = await firstValueFrom(this.http.get<{ data: SchedulingResources }>(
      this.url(organizationId, clinicId), { withCredentials: true },
    ));
    return response.data;
  }

  async createProvider(organizationId: string, clinicId: string, input: {
    displayName: string; role: ProviderRole; color?: string;
  }): Promise<ClinicProvider> {
    const response = await firstValueFrom(this.http.post<{ data: ClinicProvider }>(
      `${this.url(organizationId, clinicId)}/providers`, input, { withCredentials: true },
    ));
    return response.data;
  }

  async createOperatory(organizationId: string, clinicId: string, input: {
    name: string; chairNumber?: number | null; color?: string;
  }): Promise<ClinicOperatory> {
    const response = await firstValueFrom(this.http.post<{ data: ClinicOperatory }>(
      `${this.url(organizationId, clinicId)}/operatories`, input, { withCredentials: true },
    ));
    return response.data;
  }

  async saveWorkingHours(organizationId: string, clinicId: string, providerId: string, hours: ProviderWorkingHour[]): Promise<void> {
    await firstValueFrom(this.http.put(
      `${this.url(organizationId, clinicId)}/providers/${encodeURIComponent(providerId)}/working-hours/bulk`,
      { hours },
      { withCredentials: true },
    ));
  }

  private url(organizationId: string, clinicId: string): string {
    return `/api/v1/organizations/${encodeURIComponent(organizationId)}/clinics/${encodeURIComponent(clinicId)}/scheduling-resources`;
  }
}
