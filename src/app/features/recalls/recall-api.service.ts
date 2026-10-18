import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type RecallStatus = 'DUE' | 'CONTACTED' | 'SCHEDULED' | 'COMPLETED' | 'DECLINED' | 'INACTIVE';
export interface PatientRecall {
  id: string; patientId: string; patientNumber: string; patientFirstName: string; patientLastName: string;
  patientPhone: string | null; recallType: string; dueOn: string; previousCompletedOn: string | null;
  intervalMonths: number; status: RecallStatus; preferredContactMethod: string | null;
  lastContactedAt: string | null; note: string | null; contactAttempts: number; lastContactOutcome: string | null;
}
interface ListResponse { data: PatientRecall[]; count: number }
interface CreateResponse { data: { id: string; status: RecallStatus } }

@Injectable({ providedIn: 'root' })
export class RecallApiService {
  private readonly http = inject(HttpClient);
  private url(org: string, clinic: string): string {
    return `/api/v1/organizations/${encodeURIComponent(org)}/clinics/${encodeURIComponent(clinic)}/recalls`;
  }
  async list(org: string, clinic: string, status = '', q = ''): Promise<ListResponse> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (q.trim()) params = params.set('q', q.trim());
    return await firstValueFrom(this.http.get<ListResponse>(this.url(org, clinic), { params, withCredentials: true }));
  }
  async create(org: string, clinic: string, input: { patientId: string; recallType: string; dueOn: string; intervalMonths: number; note?: string }): Promise<CreateResponse['data']> {
    const response = await firstValueFrom(this.http.post<CreateResponse>(this.url(org, clinic), input, { withCredentials: true }));
    return response.data;
  }
  async changeStatus(org: string, clinic: string, recallId: string, status: RecallStatus): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.url(org, clinic)}/${encodeURIComponent(recallId)}/status`, { status }, { withCredentials: true }));
  }
  async recordContact(org: string, clinic: string, recallId: string, input: { contactMethod: string; outcome: string; note?: string }): Promise<void> {
    await firstValueFrom(this.http.post(`${this.url(org, clinic)}/${encodeURIComponent(recallId)}/contacts`, input, { withCredentials: true }));
  }
}
