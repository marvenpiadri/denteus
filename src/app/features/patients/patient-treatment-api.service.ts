import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type TreatmentStatus = 'PLANNED' | 'ACCEPTED' | 'COMPLETED' | 'DECLINED';
export type TreatmentCategory = 'EXAM' | 'HYGIENE' | 'RESTORATIVE' | 'ENDODONTICS' | 'EXTRACTION' | 'PROSTHODONTICS' | 'ORTHODONTICS' | 'PERIODONTICS' | 'IMPLANT' | 'OTHER';
export type ToothSurface = 'WHOLE' | 'OCCLUSAL' | 'INCISAL' | 'MESIAL' | 'DISTAL' | 'BUCCAL' | 'LINGUAL' | 'PALATAL' | 'CERVICAL';

export interface ToothSite {
  toothNo: number;
  surface: ToothSurface;
}
export interface TreatmentEvent {
  action: 'CREATED' | 'STATUS_CHANGED';
  fromStatus: TreatmentStatus | null;
  toStatus: TreatmentStatus;
  actorName: string | null;
  createdAt: string;
}
export interface PatientTreatment {
  id: string;
  patientId: string;
  appointmentId: string | null;
  appointmentStartsAt: string | null;
  appointmentReason: string | null;
  title: string;
  category: TreatmentCategory;
  status: TreatmentStatus;
  notes: string | null;
  performedAt: string | null;
  performedById: string | null;
  performedByName: string | null;
  recordedById: string | null;
  recordedByName: string | null;
  createdAt: string;
  updatedAt: string;
  toothSites: ToothSite[];
  events: TreatmentEvent[];
}
export interface CreatePatientTreatmentInput {
  title: string;
  category: TreatmentCategory;
  status: TreatmentStatus;
  notes?: string | null;
  appointmentId?: string | null;
  toothSites: ToothSite[];
}

@Injectable({ providedIn: 'root' })
export class PatientTreatmentApiService {
  private readonly http = inject(HttpClient);

  async list(organizationId: string, clinicId: string, patientId: string): Promise<PatientTreatment[]> {
    const response = await firstValueFrom(this.http.get<{ data: PatientTreatment[] }>(
      this.collectionUrl(organizationId, clinicId, patientId), { withCredentials: true },
    ));
    return response.data;
  }

  async create(organizationId: string, clinicId: string, patientId: string, input: CreatePatientTreatmentInput): Promise<PatientTreatment> {
    const response = await firstValueFrom(this.http.post<{ data: PatientTreatment }>(
      this.collectionUrl(organizationId, clinicId, patientId), input, { withCredentials: true },
    ));
    return response.data;
  }

  async changeStatus(organizationId: string, clinicId: string, patientId: string, treatmentId: string, status: TreatmentStatus): Promise<void> {
    await firstValueFrom(this.http.patch(
      `${this.collectionUrl(organizationId, clinicId, patientId)}/${encodeURIComponent(treatmentId)}/status`,
      { status }, { withCredentials: true },
    ));
  }

  private collectionUrl(organizationId: string, clinicId: string, patientId: string): string {
    return `/api/v1/organizations/${encodeURIComponent(organizationId)}/clinics/${encodeURIComponent(clinicId)}/patients/${encodeURIComponent(patientId)}/treatments`;
  }
}
