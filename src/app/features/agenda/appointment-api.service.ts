import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface AppointmentRecord {
  id: string;
  organizationId: string;
  clinicId: string;
  patientId: string;
  patientNumber: string;
  patientFirstName: string;
  patientLastName: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  reason: string | null;
  providerId: string | null;
  providerName: string | null;
  operatoryId: string | null;
  operatoryName: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AppointmentListResponse {
  data: AppointmentRecord[];
  count: number;
}
interface AppointmentResponse {
  data: AppointmentRecord;
}

export interface CreateAppointmentInput {
  patientId: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
  providerId?: string | null;
  operatoryId?: string | null;
}

export interface UpdateAppointmentInput {
  patientId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  providerId: string | null;
  operatoryId: string | null;
}

@Injectable({ providedIn: 'root' })
export class AppointmentApiService {
  private readonly http = inject(HttpClient);

  async list(organizationId: string, clinicId: string, from: string, to: string): Promise<AppointmentListResponse> {
    const params = new HttpParams().set('from', from).set('to', to);
    return await firstValueFrom(this.http.get<AppointmentListResponse>(
      this.collectionUrl(organizationId, clinicId),
      { params, withCredentials: true },
    ));
  }

  async listForPatient(organizationId: string, clinicId: string, patientId: string): Promise<AppointmentRecord[]> {
    const response = await firstValueFrom(this.http.get<AppointmentListResponse>(
      `/api/v1/organizations/${encodeURIComponent(organizationId)}/clinics/${encodeURIComponent(clinicId)}/patients/${encodeURIComponent(patientId)}/appointments`,
      { withCredentials: true },
    ));
    return response.data;
  }

  async create(organizationId: string, clinicId: string, input: CreateAppointmentInput): Promise<AppointmentRecord> {
    const response = await firstValueFrom(this.http.post<AppointmentResponse>(
      this.collectionUrl(organizationId, clinicId),
      input,
      { withCredentials: true },
    ));
    return response.data;
  }

  async changeStatus(organizationId: string, clinicId: string, appointmentId: string, status: AppointmentStatus): Promise<void> {
    await firstValueFrom(this.http.patch(
      `${this.collectionUrl(organizationId, clinicId)}/${encodeURIComponent(appointmentId)}/status`,
      { status },
      { withCredentials: true },
    ));
  }

  async reschedule(
    organizationId: string,
    clinicId: string,
    appointmentId: string,
    startsAt: string,
    endsAt: string,
    providerId?: string | null,
    operatoryId?: string | null,
  ): Promise<void> {
    await this.update(organizationId, clinicId, appointmentId, {
      startsAt,
      endsAt,
      ...(providerId !== undefined ? { providerId } : {}),
      ...(operatoryId !== undefined ? { operatoryId } : {}),
    });
  }

  async update(
    organizationId: string,
    clinicId: string,
    appointmentId: string,
    input: Partial<UpdateAppointmentInput> & Pick<UpdateAppointmentInput, 'startsAt' | 'endsAt'>,
  ): Promise<void> {
    await firstValueFrom(this.http.patch(
      `${this.collectionUrl(organizationId, clinicId)}/${encodeURIComponent(appointmentId)}/reschedule`,
      input,
      { withCredentials: true },
    ));
  }

  private collectionUrl(organizationId: string, clinicId: string): string {
    return `/api/v1/organizations/${encodeURIComponent(organizationId)}/clinics/${encodeURIComponent(clinicId)}/appointments`;
  }
}
