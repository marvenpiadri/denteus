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
        nationalId: null,
        phone: '+212600000000',
        email: null,
        address: null,
        city: null,
        notes: null,
        createdAt: '2026-10-17T10:00:00.000Z',
        updatedAt: '2026-10-17T10:00:00.000Z',
      },
    });
    await expect(result).resolves.toMatchObject({ id: 'patient-1', patientNumber: 'DEN-2026-000001' });
  });

  it('loads a single patient through the selected clinic path', async () => {
    const result = service.get('org-1', 'clinic-1', 'patient-1');
    const request = http.expectOne('/api/v1/organizations/org-1/clinics/clinic-1/patients/patient-1');
    expect(request.request.method).toBe('GET');
    request.flush({ data: {
      id: 'patient-1',
      organizationId: 'org-1',
      patientNumber: 'DEN-2026-000001',
      firstName: 'Samira',
      lastName: 'Test',
      birthDate: null,
      gender: null,
      nationalId: null,
      phone: null,
      email: null,
      address: null,
      city: null,
      notes: null,
      createdAt: '2026-10-17T10:00:00.000000Z',
      updatedAt: '2026-10-17T10:00:00.123456Z',
    }});
    await expect(result).resolves.toMatchObject({ id: 'patient-1', updatedAt: '2026-10-17T10:00:00.123456Z' });
  });

  it('updates a patient using the last-read timestamp to detect concurrent edits', async () => {
    const input = {
      firstName: 'Samira',
      lastName: 'Test',
      birthDate: null,
      gender: null,
      phone: null,
      email: null,
      address: null,
      city: null,
      notes: null,
      expectedUpdatedAt: '2026-10-17T10:00:00.123456Z',
    };
    const result = service.update('org-1', 'clinic-1', 'patient-1', input);
    const request = http.expectOne('/api/v1/organizations/org-1/clinics/clinic-1/patients/patient-1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.expectedUpdatedAt).toBe(input.expectedUpdatedAt);
    request.flush({ data: {
      id: 'patient-1',
      organizationId: 'org-1',
      patientNumber: 'DEN-2026-000001',
      firstName: 'Samira',
      lastName: 'Test',
      birthDate: null,
      gender: null,
      nationalId: null,
      phone: null,
      email: null,
      address: null,
      city: null,
      notes: null,
      createdAt: '2026-10-17T10:00:00.000000Z',
      updatedAt: '2026-10-17T10:00:02.654321Z',
    }});
    await expect(result).resolves.toMatchObject({ updatedAt: '2026-10-17T10:00:02.654321Z' });
  });
});
