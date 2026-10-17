import { DatePipe, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { CreatePatientInput, PatientApiService, PatientRecord } from './patient-api.service';

@Component({
  selector: 'app-patient-list-page',
  imports: [FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './patient-list-page.component.html',
  styleUrl: './patient-list-page.component.css',
})
export class PatientListPageComponent {
  readonly tenant = inject(TenantContextService);
  private readonly patientsApi = inject(PatientApiService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly patients = signal<PatientRecord[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  search = '';
  readonly showCreateForm = signal(false);
  readonly total = signal(0);

  firstName = '';
  lastName = '';
  birthDate = '';
  gender: '' | 'M' | 'F' | 'OTHER' = '';
  phone = '';
  email = '';

  constructor() {
    effect(() => {
      const clinic = this.tenant.activeClinic();
      if (isPlatformBrowser(this.platformId) && clinic) {
        void this.loadPatients(clinic.organizationId, clinic.id, this.search);
      }
    });
  }

  toggleCreateForm(): void {
    this.showCreateForm.update((open) => !open);
  }

  async searchPatients(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (clinic) await this.loadPatients(clinic.organizationId, clinic.id, this.search);
  }

  async loadPatients(organizationId: string, clinicId: string, query = ''): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await this.patientsApi.list(organizationId, clinicId, query);
      this.patients.set(response.data);
      this.total.set(response.count);
    } catch (error) {
      this.patients.set([]);
      this.total.set(0);
      this.error.set(error instanceof HttpErrorResponse && error.status === 401
        ? 'Votre session a expiré. Reconnectez-vous.'
        : error instanceof HttpErrorResponse && error.status === 404
          ? 'Cette clinique n’est plus accessible avec votre compte.'
          : 'Les dossiers patients ne peuvent pas être chargés. Vérifiez votre connexion puis réessayez.');
    } finally {
      this.loading.set(false);
    }
  }

  async createPatient(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic || this.saving()) return;
    this.formError.set('');
    this.saving.set(true);
    const input: CreatePatientInput = {
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      ...(this.birthDate ? { birthDate: this.birthDate } : {}),
      ...(this.gender ? { gender: this.gender } : {}),
      ...(this.phone.trim() ? { phone: this.phone.trim() } : {}),
      ...(this.email.trim() ? { email: this.email.trim().toLowerCase() } : {}),
    };
    try {
      await this.patientsApi.create(clinic.organizationId, clinic.id, input);
      this.firstName = '';
      this.lastName = '';
      this.birthDate = '';
      this.gender = '';
      this.phone = '';
      this.email = '';
      this.showCreateForm.set(false);
      await this.loadPatients(clinic.organizationId, clinic.id, this.search);
    } catch (error) {
      this.formError.set(error instanceof HttpErrorResponse && error.status === 403
        ? 'Votre rôle ne permet pas de créer un dossier patient.'
        : error instanceof HttpErrorResponse && error.status === 401
          ? 'Votre session a expiré. Reconnectez-vous avant de continuer.'
          : 'Le dossier n’a pas été enregistré. Aucune donnée n’a été ajoutée à la liste. Réessayez.');
    } finally {
      this.saving.set(false);
    }
  }

  patientInitials(patient: PatientRecord): string {
    return `${patient.firstName.trim().charAt(0)}${patient.lastName.trim().charAt(0)}`.toUpperCase();
  }
}
