import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppointmentApiService } from './appointment-api.service';

describe('AppointmentApiService', () => {
  let service: AppointmentApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AppointmentApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads appointments for a bounded clinic-local date range converted to UTC', async () => {
    const result = service.list('org-1', 'clinic-1', '2026-10-17T23:00:00.000Z', '2026-10-18T23:00:00.000Z');
    const request = http.expectOne((req) =>
      req.url === '/api/v1/organizations/org-1/clinics/clinic-1/appointments'
      && req.params.get('from') === '2026-10-17T23:00:00.000Z'
      && req.params.get('to') === '2026-10-18T23:00:00.000Z',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ data: [], count: 0 });
    await expect(result).resolves.toEqual({ data: [], count: 0 });
  });

  it('creates appointments only in the supplied clinic context', async () => {
    const input = {
      patientId: 'patient-1',
      startsAt: '2026-10-17T09:00:00.000Z',
      endsAt: '2026-10-17T09:30:00.000Z',
      reason: 'Contrôle',
    };
    const result = service.create('org-1', 'clinic-1', input);
    const request = http.expectOne('/api/v1/organizations/org-1/clinics/clinic-1/appointments');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({ data: { id: 'appointment-1', ...input, organizationId: 'org-1', clinicId: 'clinic-1', patientNumber: 'DEN-1', patientFirstName: 'Samira', patientLastName: 'Test', status: 'SCHEDULED', createdById: 'user-1', createdAt: '', updatedAt: '' } });
    await expect(result).resolves.toMatchObject({ id: 'appointment-1', status: 'SCHEDULED' });
  });

  it('sends explicit status transitions and rescheduling to the appointment endpoint', async () => {
    const status = service.changeStatus('org-1', 'clinic-1', 'appointment-1', 'CONFIRMED');
    const statusRequest = http.expectOne('/api/v1/organizations/org-1/clinics/clinic-1/appointments/appointment-1/status');
    expect(statusRequest.request.method).toBe('PATCH');
    expect(statusRequest.request.body).toEqual({ status: 'CONFIRMED' });
    statusRequest.flush({ data: { id: 'appointment-1', status: 'CONFIRMED' } });
    await expect(status).resolves.toBeUndefined();

    const reschedule = service.reschedule('org-1', 'clinic-1', 'appointment-1', '2026-10-18T09:00:00.000Z', '2026-10-18T09:30:00.000Z');
    const rescheduleRequest = http.expectOne('/api/v1/organizations/org-1/clinics/clinic-1/appointments/appointment-1/reschedule');
    expect(rescheduleRequest.request.method).toBe('PATCH');
    expect(rescheduleRequest.request.body).toEqual({
      startsAt: '2026-10-18T09:00:00.000Z',
      endsAt: '2026-10-18T09:30:00.000Z',
    });
    rescheduleRequest.flush({ data: { id: 'appointment-1' } });
    await expect(reschedule).resolves.toBeUndefined();
  });
  it('saves appointment edits through the clinic-scoped scheduling endpoint', async () => {
    const result = service.update('org-1', 'clinic-1', 'appointment-1', {
      startsAt: '2026-10-18T09:00:00.000Z',
      endsAt: '2026-10-18T09:45:00.000Z',
      providerId: 'provider-1',
      operatoryId: 'operatory-1',
      patientId: 'patient-2',
      reason: 'Contrôle annuel',
    });
    const request = http.expectOne('/api/v1/organizations/org-1/clinics/clinic-1/appointments/appointment-1/reschedule');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      startsAt: '2026-10-18T09:00:00.000Z',
      endsAt: '2026-10-18T09:45:00.000Z',
      providerId: 'provider-1',
      operatoryId: 'operatory-1',
      patientId: 'patient-2',
      reason: 'Contrôle annuel',
    });
    expect(request.request.withCredentials).toBe(true);
    request.flush({ data: { id: 'appointment-1' } });
    await expect(result).resolves.toBeUndefined();
  });

});
