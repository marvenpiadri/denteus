import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
}

export interface AuthenticatedSession {
  expiresAt: string;
}

interface SessionResponse {
  user: AuthenticatedUser;
  session: AuthenticatedSession;
}

export type SessionStatus = 'unknown' | 'loading' | 'authenticated' | 'unauthenticated' | 'unavailable';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);

  readonly status = signal<SessionStatus>('unknown');
  readonly user = signal<AuthenticatedUser | null>(null);
  readonly session = signal<AuthenticatedSession | null>(null);

  async ensureSession(forceRefresh = false): Promise<boolean> {
    if (!forceRefresh && this.status() === 'authenticated') return true;
    if (!forceRefresh && this.status() === 'unauthenticated') return false;

    this.status.set('loading');
    try {
      const result = await firstValueFrom(
        this.http.get<SessionResponse>('/api/v1/session', { withCredentials: true }),
      );
      this.user.set(result.user);
      this.session.set(result.session);
      this.status.set('authenticated');
      return true;
    } catch (error) {
      this.user.set(null);
      this.session.set(null);
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.status.set('unauthenticated');
      } else {
        this.status.set('unavailable');
      }
      return false;
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    await firstValueFrom(
      this.http.post('/api/auth/sign-in/email', { email, password }, { withCredentials: true }),
    );
    const authenticated = await this.ensureSession(true);
    if (!authenticated) {
      throw new Error('La connexion a été acceptée, mais la session n’a pas pu être vérifiée. Réessayez.');
    }
  }

  async signOut(): Promise<void> {
    await firstValueFrom(
      this.http.post('/api/auth/sign-out', {}, { withCredentials: true }),
    );
    this.user.set(null);
    this.session.set(null);
    this.status.set('unauthenticated');
  }

  messageFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Le service de connexion est injoignable. Vérifiez que l’API Dentaleus est démarrée.';
      }
      const payload = error.error as { message?: unknown; error?: { message?: unknown } } | null;
      const message = payload?.message ?? payload?.error?.message;
      if (typeof message === 'string' && message.trim()) return message;
      if (error.status === 401 || error.status === 403) return 'Adresse e-mail ou mot de passe incorrect.';
      if (error.status >= 500) return 'Le service de connexion rencontre un problème. Réessayez plus tard.';
    }
    if (error instanceof Error && error.message) return error.message;
    return 'La connexion a échoué. Vérifiez vos informations et réessayez.';
  }
}
