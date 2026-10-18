import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PatientTreatmentApiService } from './patient-treatment-api.service';

describe('PatientTreatmentApiService', () => {
  let service: PatientTreatmentApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PatientTreatmentApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads a patient-scoped treatment history with credentials', async () => {
    const result = service.list('org-1', 'clinic-1', 'patient-1');
    const request = http.expectOne('/api/v1/organizations/org-1/clinics/clinic-1/patients/patient-1/treatments');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ data: [] });
    await expect(result).resolves.toEqual([]);
  });

  it('records tooth and surface links in the clinic-scoped treatment endpoint', async () => {
    const input = {
      title: 'Restauration composite',
      category: 'RESTORATIVE' as const,
      status: 'COMPLETED' as const,
      toothSites: [{ toothNo: 36, surface: 'OCCLUSAL' as const }],
    };
    const result = service.create('org-1', 'clinic-1', 'patient-1', input);
    const request = http.expectOne('/api/v1/organizations/org-1/clinics/clinic-1/patients/patient-1/treatments');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({ data: { id: 'treatment-1', patientId: 'patient-1', ...input, appointmentId: null, notes: null, performedAt: '2026-10-18T10:00:00.000Z', performedById: 'user-1', performedByName: 'Clinician', recordedById: 'user-1', recordedByName: 'Clinician', createdAt: '', updatedAt: '', events: [] } });
    await expect(result).resolves.toMatchObject({ id: 'treatment-1', toothSites: [{ toothNo: 36, surface: 'OCCLUSAL' }] });
  });

  it('requests an explicit treatment status transition', async () => {
    const result = service.changeStatus('org-1', 'clinic-1', 'patient-1', 'treatment-1', 'ACCEPTED');
    const request = http.expectOne('/api/v1/organizations/org-1/clinics/clinic-1/patients/patient-1/treatments/treatment-1/status');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'ACCEPTED' });
    request.flush({ data: { id: 'treatment-1', status: 'ACCEPTED' } });
    await expect(result).resolves.toBeUndefined();
  });
});
