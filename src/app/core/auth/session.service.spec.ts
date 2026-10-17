import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SessionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the authenticated session using the browser cookie', async () => {
    const result = service.ensureSession();
    const request = http.expectOne('/api/v1/session');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({
      user: {
        id: 'user-1',
        name: 'Dentist',
        email: 'dentist@example.test',
        emailVerified: true,
        image: null,
      },
      session: { expiresAt: '2026-12-01T00:00:00.000Z' },
    });

    await expect(result).resolves.toBe(true);
    expect(service.status()).toBe('authenticated');
    expect(service.user()?.id).toBe('user-1');
  });

  it('treats a 401 response as an unauthenticated session', async () => {
    const result = service.ensureSession();
    http.expectOne('/api/v1/session').flush(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } },
      { status: 401, statusText: 'Unauthorized' },
    );

    await expect(result).resolves.toBe(false);
    expect(service.status()).toBe('unauthenticated');
    expect(service.user()).toBeNull();
  });

  it('signs in then verifies the newly issued session', async () => {
    const result = service.signIn('dentist@example.test', 'a-long-test-password');
    const login = http.expectOne('/api/auth/sign-in/email');
    expect(login.request.method).toBe('POST');
    expect(login.request.body).toEqual({
      email: 'dentist@example.test',
      password: 'a-long-test-password',
    });
    expect(login.request.withCredentials).toBe(true);
    login.flush({ token: 'test-only' });
    await Promise.resolve();

    const session = http.expectOne('/api/v1/session');
    session.flush({
      user: {
        id: 'user-1',
        name: 'Dentist',
        email: 'dentist@example.test',
        emailVerified: true,
        image: null,
      },
      session: { expiresAt: '2026-12-01T00:00:00.000Z' },
    });

    await expect(result).resolves.toBeUndefined();
    expect(service.status()).toBe('authenticated');
  });
});
