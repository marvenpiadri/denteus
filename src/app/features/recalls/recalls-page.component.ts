import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { PatientApiService } from '../patients/patient-api.service';
import type { PatientListRecord } from '../patients/patient-api.service';
import { RecallApiService } from './recall-api.service';
import type { PatientRecall, RecallStatus } from './recall-api.service';
import { formatClinicDate, formatClinicTime, todayInTimeZone } from '../agenda/clinic-date-time';

function clinicTimezone(value: string | undefined): string { return value || 'Africa/Casablanca'; }

@Component({
  selector: 'app-recalls-page',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recalls-page.component.html',
  styleUrl: './recalls-page.component.css',
})
export class RecallsPageComponent {
  readonly tenant = inject(TenantContextService);
  private readonly recallsApi = inject(RecallApiService);
  private readonly patientsApi = inject(PatientApiService);
  private readonly platformId = inject(PLATFORM_ID);
  readonly recalls = signal<PatientRecall[]>([]);
  readonly patients = signal<PatientListRecord[]>([]);
  readonly loading = signal(false);
  readonly loadingPatients = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly success = signal('');
  readonly filterStatus = signal('');
  readonly query = signal('');
  readonly showCreateForm = signal(false);
  readonly contactRecallId = signal<string | null>(null);
  readonly contactError = signal('');
  readonly contactSaving = signal(false);
  patientId = '';
  recallType = 'Contrôle périodique';
  dueOn = '';
  intervalMonths = 6;
  note = '';
  contactMethod = 'PHONE';
  contactOutcome = 'NO_ANSWER';
  contactNote = '';
  private requestSequence = 0;
  private clinicSequence = 0;
  private activeClinicId = '';

  constructor() {
    effect(() => {
      const clinic = this.tenant.activeClinic();
      const clinicId = clinic?.id ?? '';
      const status = this.filterStatus();
      const query = this.query();
      if (clinicId !== this.activeClinicId) {
        this.activeClinicId = clinicId;
        this.clinicSequence++;
        this.requestSequence++;
        this.recalls.set([]);
        this.patients.set([]);
        this.loading.set(false);
        this.loadingPatients.set(false);
        this.saving.set(false);
        this.contactSaving.set(false);
        this.error.set('');
        this.formError.set('');
        this.success.set('');
        this.contactError.set('');
        this.contactRecallId.set(null);
        this.showCreateForm.set(false);
        this.patientId = '';
        this.note = '';
      }
      if (isPlatformBrowser(this.platformId) && clinic) void this.loadRecalls(clinic.organizationId, clinic.id, status, query);
    });
    effect(() => {
      const clinic = this.tenant.activeClinic();
      if (isPlatformBrowser(this.platformId) && clinic) void this.loadPatients(clinic.organizationId, clinic.id);
    });
  }

  retryRecalls(): void {
    const clinic = this.tenant.activeClinic();
    if (!clinic || this.loading()) return;
    void this.loadRecalls(clinic.organizationId, clinic.id, this.filterStatus(), this.query());
  }

  async loadRecalls(org: string, clinicId: string, status: string, query: string): Promise<void> {
    const sequence = ++this.requestSequence;
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await this.recallsApi.list(org, clinicId, status, query);
      if (sequence !== this.requestSequence || this.tenant.activeClinic()?.id !== clinicId) return;
      this.recalls.set(response.data);
    } catch (error) {
      if (sequence !== this.requestSequence) return;
      this.recalls.set([]);
      this.error.set(error instanceof HttpErrorResponse && error.status === 401
        ? 'Votre session a expiré. Reconnectez-vous.'
        : 'La liste des rappels ne peut pas être chargée. Réessayez.');
    } finally {
      if (sequence === this.requestSequence) this.loading.set(false);
    }
  }

  async loadPatients(org: string, clinicId: string): Promise<void> {
    const clinicSequence = this.clinicSequence;
    this.loadingPatients.set(true);
    try {
      const response = await this.patientsApi.list(org, clinicId);
      if (clinicSequence === this.clinicSequence && this.tenant.activeClinic()?.id === clinicId) this.patients.set(response.data);
    } catch {
      if (clinicSequence === this.clinicSequence && this.tenant.activeClinic()?.id === clinicId) this.patients.set([]);
    } finally {
      if (clinicSequence === this.clinicSequence && this.tenant.activeClinic()?.id === clinicId) this.loadingPatients.set(false);
    }
  }

  openCreate(): void {
    if (this.saving() || this.contactSaving() || !this.tenant.activeClinic()) return;
    this.formError.set('');
    this.patientId = '';
    this.recallType = 'Contrôle périodique';
    this.dueOn = todayInTimeZone(clinicTimezone(this.tenant.activeClinic()?.timezone));
    this.intervalMonths = 6;
    this.note = '';
    this.showCreateForm.set(true);
  }

  async createRecall(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic || this.saving() || this.contactSaving()) return;
    const clinicSequence = this.clinicSequence;
    this.saving.set(true);
    this.formError.set('');
    this.success.set('');
    try {
      await this.recallsApi.create(clinic.organizationId, clinic.id, {
        patientId: this.patientId,
        recallType: this.recallType.trim(),
        dueOn: this.dueOn,
        intervalMonths: Number(this.intervalMonths),
        ...(this.note.trim() ? { note: this.note.trim() } : {}),
      });
      if (clinicSequence !== this.clinicSequence || this.tenant.activeClinic()?.id !== clinic.id) return;
      this.showCreateForm.set(false);
      this.success.set('Le rappel a été enregistré.');
      await this.loadRecalls(clinic.organizationId, clinic.id, this.filterStatus(), this.query());
    } catch (error) {
      if (clinicSequence !== this.clinicSequence || this.tenant.activeClinic()?.id !== clinic.id) return;
      this.formError.set(error instanceof HttpErrorResponse && error.status === 404
        ? 'Ce patient n’est pas accessible dans la clinique active.'
        : 'Le rappel n’a pas été enregistré. Vérifiez les champs et réessayez.');
    } finally {
      if (clinicSequence === this.clinicSequence) this.saving.set(false);
    }
  }

  openContact(recall: PatientRecall): void {
    if (this.saving() || this.contactSaving()) return;
    this.contactRecallId.set(recall.id);
    this.contactError.set('');
    this.contactMethod = recall.preferredContactMethod && recall.preferredContactMethod !== 'UNKNOWN' ? recall.preferredContactMethod : 'PHONE';
    this.contactOutcome = 'NO_ANSWER';
    this.contactNote = '';
  }

  async saveContact(recall: PatientRecall): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic || this.contactSaving() || this.saving()) return;
    const clinicSequence = this.clinicSequence;
    this.contactSaving.set(true);
    this.contactError.set('');
    try {
      await this.recallsApi.recordContact(clinic.organizationId, clinic.id, recall.id, {
        contactMethod: this.contactMethod,
        outcome: this.contactOutcome,
        ...(this.contactNote.trim() ? { note: this.contactNote.trim() } : {}),
      });
      if (clinicSequence !== this.clinicSequence || this.tenant.activeClinic()?.id !== clinic.id) return;
      this.contactRecallId.set(null);
      this.success.set('La tentative de contact a été ajoutée à l’historique.');
      await this.loadRecalls(clinic.organizationId, clinic.id, this.filterStatus(), this.query());
    } catch {
      if (clinicSequence !== this.clinicSequence || this.tenant.activeClinic()?.id !== clinic.id) return;
      this.contactError.set('La tentative n’a pas été enregistrée. Réessayez.');
    } finally {
      if (clinicSequence === this.clinicSequence) this.contactSaving.set(false);
    }
  }

  async changeRecallStatus(recall: PatientRecall, status: RecallStatus): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic || this.saving() || this.contactSaving()) return;
    if ((status === 'DECLINED' || status === 'INACTIVE') && !globalThis.confirm('Confirmer ce changement de statut du rappel ?')) return;
    const clinicSequence = this.clinicSequence;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await this.recallsApi.changeStatus(clinic.organizationId, clinic.id, recall.id, status);
      if (clinicSequence !== this.clinicSequence || this.tenant.activeClinic()?.id !== clinic.id) return;
      this.success.set('Le statut du rappel a été mis à jour.');
      await this.loadRecalls(clinic.organizationId, clinic.id, this.filterStatus(), this.query());
    } catch {
      if (clinicSequence !== this.clinicSequence || this.tenant.activeClinic()?.id !== clinic.id) return;
      this.error.set('Le statut du rappel n’a pas été modifié. Réessayez.');
    } finally {
      if (clinicSequence === this.clinicSequence) this.saving.set(false);
    }
  }

  statusLabel(status: RecallStatus): string {
    const labels: Record<RecallStatus, string> = { DUE: 'À contacter', CONTACTED: 'Contact tenté', SCHEDULED: 'Rendez-vous planifié', COMPLETED: 'Effectué', DECLINED: 'Refusé', INACTIVE: 'Inactif' };
    return labels[status];
  }

  formatDate(value: string | null): string {
    if (!value) return '—';
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
  }

  formatContactTimestamp(value: string): string {
    const timezone = this.tenant.activeClinic()?.timezone || 'Africa/Casablanca';
    return `${formatClinicDate(value, timezone)} à ${formatClinicTime(value, timezone)}`;
  }

  dueLabel(value: string): string {
    const today = todayInTimeZone(this.tenant.activeClinic()?.timezone || 'Africa/Casablanca');
    if (value < today) return 'En retard';
    if (value === today) return 'Aujourd’hui';
    return 'À venir';
  }
}
