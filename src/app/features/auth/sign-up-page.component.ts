import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../core/auth/session.service';

@Component({
  selector: 'app-sign-up-page',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sign-up-page.component.html',
  styleUrl: './sign-up-page.component.css',
})
export class SignUpPageComponent {
  private readonly http = inject(HttpClient);
  private readonly sessions = inject(SessionService);
  private readonly router = inject(Router);

  name = '';
  email = '';
  password = '';
  readonly submitting = signal(false);
  readonly error = signal('');

  async submit(): Promise<void> {
    if (this.submitting()) return;
    this.error.set('');
    this.submitting.set(true);
    try {
      await firstValueFrom(this.http.post('/api/auth/sign-up/email', {
        name: this.name.trim(),
        email: this.email.trim().toLowerCase(),
        password: this.password,
      }, { withCredentials: true }));
      const authenticated = await this.sessions.ensureSession(true);
      if (!authenticated) {
        throw new Error('Votre compte a été créé, mais la session n’a pas pu être vérifiée. Connectez-vous pour continuer.');
      }
      await this.router.navigateByUrl('/onboarding/clinic');
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const payload = error.error as { message?: unknown; error?: { message?: unknown } } | null;
        const message = payload?.message ?? payload?.error?.message;
        this.error.set(typeof message === 'string' ? message : this.sessions.messageFor(error));
      } else {
        this.error.set(error instanceof Error ? error.message : 'La création du compte a échoué.');
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
