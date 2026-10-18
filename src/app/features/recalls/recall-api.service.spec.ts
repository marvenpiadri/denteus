import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RecallApiService } from './recall-api.service';

describe('RecallApiService', () => {
  let service: RecallApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RecallApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads recalls within the requested organization and clinic scope', async () => {
    const result = service.list('org-1', 'clinic-1', 'DUE', 'Samira');
    const request = http.expectOne((req) =>
      req.url === '/api/v1/organizations/org-1/clinics/clinic-1/recalls'
      && req.params.get('status') === 'DUE'
      && req.params.get('q') === 'Samira',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ data: [], count: 0 });
    await expect(result).resolves.toEqual({ data: [], count: 0 });
  });

  it('creates a recall with the requested due date and interval', async () => {
    const input = { patientId: 'patient-1', recallType: 'Contrôle périodique', dueOn: '2026-11-17', intervalMonths: 6 };
    const result = service.create('org-1', 'clinic-1', input);
    const request = http.expectOne('/api/v1/organizations/org-1/clinics/clinic-1/recalls');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({ data: { id: 'recall-1', status: 'DUE' } });
    await expect(result).resolves.toEqual({ id: 'recall-1', status: 'DUE' });
  });

  it('records a contact attempt rather than pretending a message was sent', async () => {
    const result = service.recordContact('org-1', 'clinic-1', 'recall-1', {
      contactMethod: 'PHONE',
      outcome: 'NO_ANSWER',
      note: 'Réessayer la semaine prochaine',
    });
    const request = http.expectOne('/api/v1/organizations/org-1/clinics/clinic-1/recalls/recall-1/contacts');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.outcome).toBe('NO_ANSWER');
    request.flush({ data: { id: 'recall-1', status: 'CONTACTED' } });
    await expect(result).resolves.toBeUndefined();
  });
});
