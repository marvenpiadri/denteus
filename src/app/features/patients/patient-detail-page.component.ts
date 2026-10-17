import { DatePipe, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { PatientApiService } from './patient-api.service';
import type { PatientRecord, UpdatePatientInput } from './patient-api.service';

@Component({
  selector: 'app-patient-detail-page',
  imports: [FormsModule, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './patient-detail-page.component.html',
  styleUrl: './patient-detail-page.component.css',
})
export class PatientDetailPageComponent {
  readonly tenant = inject(TenantContextService);
  private readonly api = inject(PatientApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  readonly patientId = toSignal(this.route.paramMap.pipe(map((params) => params.get('patientId'))), { initialValue: null });

  readonly patient = signal<PatientRecord | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly editing = signal(false);
  readonly conflict = signal(false);

  firstName = '';
  lastName = '';
  birthDate = '';
  gender: '' | 'M' | 'F' | 'OTHER' = '';
  phone = '';
  email = '';
  address = '';
  city = '';
  notes = '';
  private requestSequence = 0;

  constructor() {
    effect(() => {
      const clinic = this.tenant.activeClinic();
      const patientId = this.patientId();
      if (isPlatformBrowser(this.platformId) && clinic && patientId) {
        void this.loadPatient(clinic.organizationId, clinic.id, patientId);
      }
    });
  }

  async loadPatient(organizationId?: string, clinicId?: string, patientId = this.patientId() ?? ''): Promise<void> {
    const clinic = this.tenant.activeClinic();
    const organization = organizationId ?? clinic?.organizationId;
    const activeClinicId = clinicId ?? clinic?.id;
    if (!organization || !activeClinicId || !patientId) return;
    const requestSequence = ++this.requestSequence;
    this.loading.set(true);
    this.error.set('');
    this.conflict.set(false);
    try {
      const patient = await this.api.get(organization, activeClinicId, patientId);
      if (requestSequence !== this.requestSequence) return;
      this.patient.set(patient);
      this.firstName = patient.firstName;
      this.lastName = patient.lastName;
      this.birthDate = patient.birthDate ? patient.birthDate.slice(0, 10) : '';
      this.gender = patient.gender ?? '';
      this.phone = patient.phone ?? '';
      this.email = patient.email ?? '';
      this.address = patient.address ?? '';
      this.city = patient.city ?? '';
      this.notes = patient.notes ?? '';
    } catch (error) {
      if (requestSequence !== this.requestSequence) return;
      this.patient.set(null);
      this.error.set(error instanceof HttpErrorResponse && error.status === 404
        ? 'Ce dossier n’existe pas dans la clinique active ou vous n’y avez pas accès.'
        : error instanceof HttpErrorResponse && error.status === 401
          ? 'Votre session a expiré. Reconnectez-vous.'
          : 'Le dossier ne peut pas être chargé. Vérifiez votre connexion puis réessayez.');
    } finally {
      if (requestSequence === this.requestSequence) this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    const patient = this.patient();
    if (!clinic || !patient || this.saving()) return;
    this.error.set('');
    this.success.set('');
    this.saving.set(true);
    const input: UpdatePatientInput = {
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      birthDate: this.birthDate || null,
      gender: this.gender || null,
      phone: this.phone.trim() || null,
      email: this.email.trim().toLowerCase() || null,
      address: this.address.trim() || null,
      city: this.city.trim() || null,
      notes: this.notes.trim() || null,
      expectedUpdatedAt: patient.updatedAt,
    };
    try {
      const saved = await this.api.update(clinic.organizationId, clinic.id, patient.id, input);
      this.patient.set(saved);
      this.editing.set(false);
      this.success.set('Les modifications ont été enregistrées.');
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.conflict.set(true);
        this.error.set('Ce dossier a été modifié dans une autre session. Rechargez la dernière version avant de réessayer.');
      } else if (error instanceof HttpErrorResponse && error.status === 403) {
        this.error.set('Votre rôle ne permet pas de modifier ce dossier patient.');
      } else {
        this.error.set('Les modifications n’ont pas été enregistrées. Le dossier affiché reste inchangé.');
      }
    } finally {
      this.saving.set(false);
    }
  }

  cancelEdit(): void {
    this.editing.set(false);
    const patient = this.patient();
    if (!patient) return;
    this.firstName = patient.firstName;
    this.lastName = patient.lastName;
    this.birthDate = patient.birthDate ? patient.birthDate.slice(0, 10) : '';
    this.gender = patient.gender ?? '';
    this.phone = patient.phone ?? '';
    this.email = patient.email ?? '';
    this.address = patient.address ?? '';
    this.city = patient.city ?? '';
    this.notes = patient.notes ?? '';
  }
}
