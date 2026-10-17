import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PatientApiService } from './patient-api.service';

describe('PatientApiService', () => {
  let service: PatientApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PatientApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists patients only through the selected organization and clinic route', async () => {
    const result = service.list('org-1', 'clinic-1', 'Samira');
    const request = http.expectOne((req) =>
      req.url === '/api/v1/organizations/org-1/clinics/clinic-1/patients'
      && req.params.get('q') === 'Samira',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ data: [], count: 0 });
    await expect(result).resolves.toEqual({ data: [], count: 0 });
  });

  it('creates a patient through the tenant-scoped endpoint and returns the persisted response', async () => {
    const input = { firstName: 'Samira', lastName: 'Test', phone: '+212600000000' };
    const result = service.create('org-1', 'clinic-1', input);
    const request = http.expectOne('/api/v1/organizations/org-1/clinics/clinic-1/patients');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    expect(request.request.withCredentials).toBe(true);
    request.flush({
      data: {
        id: 'patient-1',
        organizationId: 'org-1',
        patientNumber: 'DEN-2026-000001',
        firstName: 'Samira',
        lastName: 'Test',
        birthDate: null,
        gender: null,
        phone: '+212600000000',
        email: null,
        city: null,
        createdAt: '2026-10-17T10:00:00.000Z',
        updatedAt: '2026-10-17T10:00:00.000Z',
      },
    });
    await expect(result).resolves.toMatchObject({ id: 'patient-1', patientNumber: 'DEN-2026-000001' });
  });
});
