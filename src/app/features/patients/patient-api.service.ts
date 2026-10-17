import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface PatientRecord {
  id: string;
  organizationId: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  gender: 'M' | 'F' | 'OTHER' | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientInput {
  firstName: string;
  lastName: string;
  birthDate?: string;
  gender?: 'M' | 'F' | 'OTHER';
  phone?: string;
  email?: string;
}

interface PatientListResponse {
  data: PatientRecord[];
  count: number;
}

interface PatientResponse {
  data: PatientRecord;
}

@Injectable({ providedIn: 'root' })
export class PatientApiService {
  private readonly http = inject(HttpClient);

  async list(organizationId: string, clinicId: string, query = ''): Promise<PatientListResponse> {
    let params = new HttpParams();
    if (query.trim()) params = params.set('q', query.trim());
    return await firstValueFrom(this.http.get<PatientListResponse>(
      this.collectionUrl(organizationId, clinicId),
      { params, withCredentials: true },
    ));
  }

  async create(organizationId: string, clinicId: string, input: CreatePatientInput): Promise<PatientRecord> {
    const result = await firstValueFrom(this.http.post<PatientResponse>(
      this.collectionUrl(organizationId, clinicId),
      input,
      { withCredentials: true },
    ));
    return result.data;
  }

  private collectionUrl(organizationId: string, clinicId: string): string {
    return `/api/v1/organizations/${encodeURIComponent(organizationId)}/clinics/${encodeURIComponent(clinicId)}/patients`;
  }
}
