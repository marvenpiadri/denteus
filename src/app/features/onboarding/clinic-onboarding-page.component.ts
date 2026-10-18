import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-clinic-onboarding-page',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clinic-onboarding-page.component.html',
  styleUrl: './clinic-onboarding-page.component.css',
})
export class ClinicOnboardingPageComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  organizationName = '';
  organizationSlug = '';
  clinicName = '';
  city = '';
  address = '';
  phone = '';
  email = '';
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly slugEdited = signal(false);

  updateOrganizationName(value: string): void {
    this.organizationName = value;
    if (!this.slugEdited()) this.organizationSlug = this.slugify(value);
  }

  updateSlug(value: string): void {
    this.slugEdited.set(true);
    this.organizationSlug = this.slugify(value);
  }

  private slugify(value: string): string {
    return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    this.error.set('');
    this.submitting.set(true);
    try {
      await firstValueFrom(this.http.post(
        '/api/v1/onboarding/clinic',
        {
          organizationName: this.organizationName.trim(),
          organizationSlug: this.organizationSlug,
          clinicName: this.clinicName.trim(),
          city: this.city.trim() || undefined,
          address: this.address.trim() || undefined,
          phone: this.phone.trim() || undefined,
          email: this.email.trim().toLowerCase() || undefined,
          timezone: 'Africa/Casablanca',
          currency: 'MAD',
          locale: 'fr',
        },
        { withCredentials: true },
      ));
      await this.router.navigateByUrl('/crm/today');
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const payload = error.error as { message?: unknown; error?: { message?: unknown } } | null;
        const message = payload?.message ?? payload?.error?.message;
        this.error.set(typeof message === 'string' ? message : 'Impossible de créer la clinique. Vérifiez les informations et réessayez.');
      } else {
        this.error.set('Impossible de créer la clinique. Réessayez.');
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
