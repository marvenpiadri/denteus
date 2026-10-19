import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { firstValueFrom } from 'rxjs';

interface AcceptResponse { data: { organizationId: string; organizationName: string; role: string }; }

@Component({
  selector: 'app-accept-invitation-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accept-invitation-page.component.html',
  styleUrl: './accept-invitation-page.component.css',
})
export class AcceptInvitationPageComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly tenant = inject(TenantContextService);
  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  readonly accepting = signal(false);
  readonly accepted = signal(false);
  readonly error = signal('');
  readonly organizationName = signal('');
  readonly role = signal('');

  async accept(): Promise<void> {
    if (!this.token || this.accepting() || this.accepted()) return;
    this.accepting.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.http.post<AcceptResponse>(
        '/api/v1/organization-invitations/accept',
        { token: this.token },
        { withCredentials: true },
      ));
      this.organizationName.set(response.data.organizationName);
      this.role.set(this.roleLabel(response.data.role));
      this.accepted.set(true);
      await this.tenant.load(true);
    } catch (error) {
      this.error.set(error instanceof HttpErrorResponse && error.status === 401
        ? 'Connectez-vous avec l’adresse e-mail qui a reçu cette invitation, puis revenez ici sans fermer cette page.'
        : error instanceof HttpErrorResponse && error.status === 403
          ? 'Cette invitation a été envoyée à une autre adresse e-mail. Connectez-vous avec l’adresse invitée.'
          : error instanceof HttpErrorResponse && error.status === 409
            ? 'Votre compte est déjà membre de cette organisation.'
            : error instanceof HttpErrorResponse && error.status === 410
              ? 'Ce lien est expiré, révoqué ou déjà utilisé. Demandez une nouvelle invitation à l’administrateur.'
              : 'L’invitation n’a pas pu être acceptée. Réessayez ou demandez une nouvelle invitation.');
    } finally {
      this.accepting.set(false);
    }
  }

  roleLabel(role: string): string {
    return ({
      ORGANIZATION_ADMIN: 'Administrateur de l’organisation',
      CLINIC_ADMIN: 'Administrateur de clinique',
      DENTIST: 'Chirurgien-dentiste',
      ORTHODONTIST: 'Orthodontiste',
      HYGIENIST: 'Hygiéniste',
      ASSISTANT: 'Assistant(e)',
      RECEPTIONIST: 'Accueil',
      ACCOUNTANT: 'Comptabilité',
    } as Record<string, string>)[role] ?? role;
  }

  continueToApp(): void {
    void this.router.navigateByUrl('/crm/today');
  }
}
