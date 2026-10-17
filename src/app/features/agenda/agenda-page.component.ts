import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { PatientApiService } from '../patients/patient-api.service';
import type { PatientRecord } from '../patients/patient-api.service';
import { AppointmentApiService } from './appointment-api.service';
import { AgendaCalendarComponent } from './agenda-calendar.component';
import type { AppointmentRecord, AppointmentStatus } from './appointment-api.service';
import { addCalendarDays, formatCalendarDate as formatCalendarDateValue, formatClinicDate, formatClinicTime, localDateTimeToIso, todayInTimeZone, toClinicDateTimeInput } from './clinic-date-time';

@Component({
  selector: 'app-agenda-page',
  imports: [FormsModule, RouterLink, AgendaCalendarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agenda-page.component.html',
  styleUrl: './agenda-page.component.css',
})
export class AgendaPageComponent {
  readonly tenant = inject(TenantContextService);
  private readonly appointmentsApi = inject(AppointmentApiService);
  private readonly patientsApi = inject(PatientApiService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly selectedDate = signal('');
  readonly appointments = signal<AppointmentRecord[]>([]);
  readonly patients = signal<PatientRecord[]>([]);
  readonly loading = signal(false);
  readonly loadingPatients = signal(false);
  readonly saving = signal(false);
  readonly changingStatusId = signal<string | null>(null);
  readonly reschedulingId = signal<string | null>(null);
  readonly showCreateForm = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly patientsError = signal('');
  readonly rescheduleError = signal('');
  readonly success = signal('');
  readonly pendingStatusChange = signal<{ appointmentId: string; status: Exclude<AppointmentStatus, 'SCHEDULED'> } | null>(null);
  private patientOptionsClinicId = '';

  patientId = '';
  startsAt = '';
  endsAt = '';
  reason = '';
  rescheduleStartsAt = '';
  rescheduleEndsAt = '';

  constructor() {
    effect(() => {
      const clinic = this.tenant.activeClinic();
      if (!isPlatformBrowser(this.platformId) || !clinic) return;
      const date = this.selectedDate();
      if (!date) {
        this.selectedDate.set(todayInTimeZone(clinic.timezone || 'Africa/Casablanca'));
        return;
      }
      void this.loadAppointments(clinic.organizationId, clinic.id, date, clinic.timezone || 'Africa/Casablanca');
    });

    effect(() => {
      const clinic = this.tenant.activeClinic();
      if (!isPlatformBrowser(this.platformId) || !clinic || this.patientOptionsClinicId === clinic.id) return;
      this.patientOptionsClinicId = clinic.id;
      void this.loadPatientOptions(clinic.organizationId, clinic.id);
    });
  }

  private async loadAppointments(organizationId: string, clinicId: string, date: string, timeZone: string): Promise<void> {
    this.loading.set(true);
    this.appointments.set([]);
    this.pendingStatusChange.set(null);
    this.error.set('');
    try {
      const from = localDateTimeToIso(`${date}T00:00`, timeZone);
      const to = localDateTimeToIso(`${addCalendarDays(date, 1)}T00:00`, timeZone);
      const response = await this.appointmentsApi.list(organizationId, clinicId, from, to);
      if (this.tenant.activeClinic()?.id !== clinicId || this.selectedDate() !== date) return;
      this.appointments.set(response.data);
    } catch (error) {
      if (this.tenant.activeClinic()?.id !== clinicId || this.selectedDate() !== date) return;
      this.appointments.set([]);
      this.error.set(error instanceof HttpErrorResponse && error.status === 401
        ? 'Votre session a expiré. Reconnectez-vous.'
        : 'L’agenda ne peut pas être chargé. Vérifiez votre connexion puis réessayez.');
    } finally {
      if (this.tenant.activeClinic()?.id === clinicId && this.selectedDate() === date) this.loading.set(false);
    }
  }

  private async loadPatientOptions(organizationId: string, clinicId: string): Promise<void> {
    this.loadingPatients.set(true);
    this.patientsError.set('');
    try {
      const response = await this.patientsApi.list(organizationId, clinicId);
      if (this.tenant.activeClinic()?.id !== clinicId) return;
      this.patients.set(response.data);
    } catch {
      if (this.tenant.activeClinic()?.id !== clinicId) return;
      this.patients.set([]);
      this.patientsError.set('La liste des patients ne peut pas être chargée. Vous devez pouvoir accéder aux dossiers pour planifier un rendez-vous.');
    } finally {
      if (this.tenant.activeClinic()?.id === clinicId) this.loadingPatients.set(false);
    }
  }

  openCreateAtTime(value: string): void {
    this.openCreateForm();
    if (!value) return;
    this.startsAt = value;
    const [datePart, timePart] = value.split('T');
    const [hour, minute] = timePart.split(':').map(Number);
    const end = new Date(Date.UTC(2000, 0, 1, hour, minute + 30));
    this.endsAt = `${datePart}T${String(end.getUTCHours()).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')}`;
  }

  openCreateForm(): void {
    const date = this.selectedDate();
    if (!date) return;
    this.formError.set('');
    this.success.set('');
    this.patientId = '';
    this.startsAt = `${date}T09:00`;
    this.endsAt = `${date}T09:30`;
    this.reason = '';
    this.showCreateForm.set(true);
  }

  async createAppointment(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic || this.saving()) return;
    this.formError.set('');
    this.success.set('');
    this.saving.set(true);
    try {
      const timezone = clinic.timezone || 'Africa/Casablanca';
      const startsAt = localDateTimeToIso(this.startsAt, timezone);
      const endsAt = localDateTimeToIso(this.endsAt, timezone);
      const created = await this.appointmentsApi.create(clinic.organizationId, clinic.id, {
        patientId: this.patientId,
        startsAt,
        endsAt,
        ...(this.reason.trim() ? { reason: this.reason.trim() } : {}),
      });
      this.showCreateForm.set(false);
      this.success.set('Le rendez-vous a été enregistré.');
      const createdDate = toClinicDateTimeInput(created.startsAt, timezone).slice(0, 10);
      if (createdDate !== this.selectedDate()) this.selectedDate.set(createdDate);
      else await this.loadAppointments(clinic.organizationId, clinic.id, this.selectedDate(), timezone);
    } catch (error) {
      this.formError.set(error instanceof Error && !(error instanceof HttpErrorResponse)
        ? error.message
        : error instanceof HttpErrorResponse && error.status === 409
          ? 'Ce patient a déjà un rendez-vous qui chevauche ce créneau. Choisissez une autre heure.'
          : error instanceof HttpErrorResponse && error.status === 404
            ? 'Le patient n’est pas accessible dans la clinique active. Rechargez la liste.'
            : error instanceof HttpErrorResponse && error.status === 403
              ? 'Votre rôle ne permet pas de planifier un rendez-vous.'
              : 'Le rendez-vous n’a pas été enregistré. Vérifiez les horaires puis réessayez.');
    } finally {
      this.saving.set(false);
    }
  }

  availableTransitions(status: AppointmentStatus): Exclude<AppointmentStatus, 'SCHEDULED'>[] {
    const transitions: Record<AppointmentStatus, Exclude<AppointmentStatus, 'SCHEDULED'>[]> = {
      SCHEDULED: ['CONFIRMED', 'ARRIVED', 'CANCELLED', 'NO_SHOW'],
      CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
      ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED'],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [],
    };
    return transitions[status];
  }

  statusLabel(status: AppointmentStatus): string {
    const labels: Record<AppointmentStatus, string> = {
      SCHEDULED: 'Planifié',
      CONFIRMED: 'Confirmé',
      ARRIVED: 'Arrivé',
      IN_PROGRESS: 'En soin',
      COMPLETED: 'Terminé',
      CANCELLED: 'Annulé',
      NO_SHOW: 'Absent',
    };
    return labels[status];
  }

  formatCalendarDate(value: string): string {
    return formatCalendarDateValue(value);
  }

  formatTime(iso: string): string {
    return formatClinicTime(iso, this.tenant.activeClinic()?.timezone || 'Africa/Casablanca');
  }

  formatDate(iso: string): string {
    return formatClinicDate(iso, this.tenant.activeClinic()?.timezone || 'Africa/Casablanca');
  }

  canReschedule(status: AppointmentStatus): boolean {
    return !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status);
  }

  openReschedule(appointment: AppointmentRecord): void {
    const timezone = this.tenant.activeClinic()?.timezone || 'Africa/Casablanca';
    this.reschedulingId.set(appointment.id);
    this.rescheduleError.set('');
    this.rescheduleStartsAt = toClinicDateTimeInput(appointment.startsAt, timezone);
    this.rescheduleEndsAt = toClinicDateTimeInput(appointment.endsAt, timezone);
  }

  async saveReschedule(appointment: AppointmentRecord): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic || this.saving()) return;
    this.rescheduleError.set('');
    this.saving.set(true);
    try {
      const timezone = clinic.timezone || 'Africa/Casablanca';
      const startsAt = localDateTimeToIso(this.rescheduleStartsAt, timezone);
      const endsAt = localDateTimeToIso(this.rescheduleEndsAt, timezone);
      await this.appointmentsApi.reschedule(clinic.organizationId, clinic.id, appointment.id, startsAt, endsAt);
      this.reschedulingId.set(null);
      this.success.set('Le rendez-vous a été déplacé.');
      const rescheduledDate = toClinicDateTimeInput(startsAt, timezone).slice(0, 10);
      if (rescheduledDate !== this.selectedDate()) this.selectedDate.set(rescheduledDate);
      else await this.loadAppointments(clinic.organizationId, clinic.id, this.selectedDate(), timezone);
    } catch (error) {
      this.rescheduleError.set(error instanceof Error && !(error instanceof HttpErrorResponse)
        ? error.message
        : error instanceof HttpErrorResponse && error.status === 409
          ? 'Le créneau n’est plus disponible ou le rendez-vous ne peut plus être déplacé.'
          : 'Le déplacement n’a pas été enregistré. Vérifiez les horaires puis réessayez.');
    } finally {
      this.saving.set(false);
    }
  }

  requestStatusChange(appointment: AppointmentRecord, status: Exclude<AppointmentStatus, 'SCHEDULED'>): void {
    if (status === 'CANCELLED' || status === 'NO_SHOW') {
      this.pendingStatusChange.set({ appointmentId: appointment.id, status });
      return;
    }
    void this.changeStatus(appointment, status);
  }

  confirmStatusChange(): void {
    const pending = this.pendingStatusChange();
    const appointment = this.appointments().find((item) => item.id === pending?.appointmentId);
    if (!pending || !appointment) return;
    this.pendingStatusChange.set(null);
    void this.changeStatus(appointment, pending.status);
  }

  async refreshAppointments(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    const date = this.selectedDate();
    if (clinic && date) await this.loadAppointments(clinic.organizationId, clinic.id, date, clinic.timezone || 'Africa/Casablanca');
  }

  retryPatientOptions(): void {
    const clinic = this.tenant.activeClinic();
    if (!clinic) return;
    this.patientOptionsClinicId = '';
    void this.loadPatientOptions(clinic.organizationId, clinic.id);
    this.patientOptionsClinicId = clinic.id;
  }

  async changeStatus(appointment: AppointmentRecord, status: Exclude<AppointmentStatus, 'SCHEDULED'>): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic || this.changingStatusId()) return;
    this.changingStatusId.set(appointment.id);
    this.error.set('');
    this.success.set('');
    try {
      await this.appointmentsApi.changeStatus(clinic.organizationId, clinic.id, appointment.id, status);
      this.success.set(`Statut mis à jour : ${this.statusLabel(status).toLowerCase()}.`);
      await this.loadAppointments(clinic.organizationId, clinic.id, this.selectedDate(), clinic.timezone || 'Africa/Casablanca');
    } catch (error) {
      this.error.set(error instanceof HttpErrorResponse && error.status === 409
        ? 'Le statut a changé ou cette transition n’est plus autorisée. Rechargez l’agenda.'
        : 'Le statut n’a pas été modifié. Réessayez.');
    } finally {
      this.changingStatusId.set(null);
    }
  }

  moveDate(days: number): void {
    const current = this.selectedDate();
    if (current) this.selectedDate.set(addCalendarDays(current, days));
  }
}
