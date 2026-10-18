import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { PatientApiService } from '../patients/patient-api.service';
import type { PatientRecord } from '../patients/patient-api.service';
import { AppointmentApiService } from './appointment-api.service';
import { AgendaCalendarComponent } from './agenda-calendar.component';
import type { CalendarAppointmentDrop, CalendarSlotSelection } from './agenda-calendar.component';
import { SchedulingResourceApiService } from './scheduling-resource-api.service';
import type { ClinicOperatory, ClinicProvider, ProviderRole, ProviderWorkingHour } from './scheduling-resource-api.service';
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
  private readonly resourcesApi = inject(SchedulingResourceApiService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly selectedDate = signal('');
  readonly appointments = signal<AppointmentRecord[]>([]);
  readonly patients = signal<PatientRecord[]>([]);
  readonly providers = signal<ClinicProvider[]>([]);
  readonly operatories = signal<ClinicOperatory[]>([]);
  readonly loadingResources = signal(false);
  readonly showResourceSetup = signal(false);
  readonly resourceSaving = signal(false);
  readonly resourceError = signal('');
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
  private resourceOptionsClinicId = '';
  private appointmentLoadSequence = 0;
  private resourceLoadSequence = 0;
  private patientOptionsLoadSequence = 0;
  private appointmentMutationSequence = 0;
  private resourceMutationSequence = 0;
  private statusMutationSequence = 0;
  private activeClinicId = '';

  patientId = '';
  startsAt = '';
  endsAt = '';
  reason = '';
  providerId = '';
  operatoryId = '';
  providerName = '';
  providerRole: ProviderRole = 'DENTIST';
  operatoryName = '';
  chairNumber = '';
  hoursProviderId = '';
  readonly weekdays = [
    { dayOfWeek: 1, label: 'Lundi', enabled: false, startsAt: '09:00', endsAt: '18:00' },
    { dayOfWeek: 2, label: 'Mardi', enabled: false, startsAt: '09:00', endsAt: '18:00' },
    { dayOfWeek: 3, label: 'Mercredi', enabled: false, startsAt: '09:00', endsAt: '18:00' },
    { dayOfWeek: 4, label: 'Jeudi', enabled: false, startsAt: '09:00', endsAt: '18:00' },
    { dayOfWeek: 5, label: 'Vendredi', enabled: false, startsAt: '09:00', endsAt: '18:00' },
    { dayOfWeek: 6, label: 'Samedi', enabled: false, startsAt: '09:00', endsAt: '13:00' },
    { dayOfWeek: 0, label: 'Dimanche', enabled: false, startsAt: '09:00', endsAt: '13:00' },
  ];
  rescheduleStartsAt = '';
  rescheduleEndsAt = '';
  rescheduleProviderId = '';
  rescheduleOperatoryId = '';

  constructor() {
    effect(() => {
      const clinic = this.tenant.activeClinic();
      if (!clinic) return;
      if (!this.activeClinicId) {
        this.activeClinicId = clinic.id;
        return;
      }
      if (this.activeClinicId === clinic.id) return;
      this.activeClinicId = clinic.id;
      this.appointmentLoadSequence++;
      this.resourceLoadSequence++;
      this.patientOptionsLoadSequence++;
      this.appointmentMutationSequence++;
      this.resourceMutationSequence++;
      this.statusMutationSequence++;
      this.appointments.set([]);
      this.patients.set([]);
      this.providers.set([]);
      this.operatories.set([]);
      this.loading.set(false);
      this.loadingPatients.set(false);
      this.loadingResources.set(false);
      this.saving.set(false);
      this.resourceSaving.set(false);
      this.changingStatusId.set(null);
      this.reschedulingId.set(null);
      this.pendingStatusChange.set(null);
      this.showCreateForm.set(false);
      this.showResourceSetup.set(false);
      this.error.set('');
      this.formError.set('');
      this.patientsError.set('');
      this.rescheduleError.set('');
      this.resourceError.set('');
      this.success.set('');
      this.patientId = '';
      this.startsAt = '';
      this.endsAt = '';
      this.reason = '';
      this.providerId = '';
      this.operatoryId = '';
      this.providerName = '';
      this.providerRole = 'DENTIST';
      this.operatoryName = '';
      this.chairNumber = '';
      this.hoursProviderId = '';
      this.rescheduleStartsAt = '';
      this.rescheduleEndsAt = '';
      this.rescheduleProviderId = '';
      this.rescheduleOperatoryId = '';
      for (const day of this.weekdays) {
        day.enabled = false;
        day.startsAt = '09:00';
        day.endsAt = day.dayOfWeek === 0 || day.dayOfWeek === 6 ? '13:00' : '18:00';
      }
      this.patientOptionsClinicId = '';
      this.resourceOptionsClinicId = '';
    });

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

    effect(() => {
      const clinic = this.tenant.activeClinic();
      if (!isPlatformBrowser(this.platformId) || !clinic || this.resourceOptionsClinicId === clinic.id) return;
      this.resourceOptionsClinicId = clinic.id;
      void this.loadResources(clinic.organizationId, clinic.id);
    });
  }

  private async loadAppointments(organizationId: string, clinicId: string, date: string, timeZone: string): Promise<void> {
    const requestSequence = ++this.appointmentLoadSequence;
    this.loading.set(true);
    this.appointments.set([]);
    this.pendingStatusChange.set(null);
    this.error.set('');
    try {
      const from = localDateTimeToIso(`${date}T00:00`, timeZone);
      const to = localDateTimeToIso(`${addCalendarDays(date, 1)}T00:00`, timeZone);
      const response = await this.appointmentsApi.list(organizationId, clinicId, from, to);
      if (requestSequence !== this.appointmentLoadSequence || this.tenant.activeClinic()?.id !== clinicId || this.selectedDate() !== date) return;
      this.appointments.set(response.data);
    } catch (error) {
      if (requestSequence !== this.appointmentLoadSequence || this.tenant.activeClinic()?.id !== clinicId || this.selectedDate() !== date) return;
      this.appointments.set([]);
      this.error.set(error instanceof HttpErrorResponse && error.status === 401
        ? 'Votre session a expiré. Reconnectez-vous.'
        : 'L’agenda ne peut pas être chargé. Vérifiez votre connexion puis réessayez.');
    } finally {
      if (requestSequence === this.appointmentLoadSequence && this.tenant.activeClinic()?.id === clinicId && this.selectedDate() === date) this.loading.set(false);
    }
  }

  private async loadResources(organizationId: string, clinicId: string): Promise<void> {
    const requestSequence = ++this.resourceLoadSequence;
    this.loadingResources.set(true);
    this.resourceError.set('');
    try {
      const result = await this.resourcesApi.list(organizationId, clinicId);
      if (requestSequence !== this.resourceLoadSequence || this.tenant.activeClinic()?.id !== clinicId) return;
      this.providers.set(result.providers);
      this.operatories.set(result.operatories);
      if (!this.providerId || !result.providers.some((item) => item.id === this.providerId)) this.providerId = '';
      if (!this.operatoryId || !result.operatories.some((item) => item.id === this.operatoryId)) this.operatoryId = '';
      if (!this.hoursProviderId || !result.providers.some((item) => item.id === this.hoursProviderId)) this.hoursProviderId = result.providers[0]?.id ?? '';
      this.syncHoursDraft();
    } catch {
      if (requestSequence !== this.resourceLoadSequence || this.tenant.activeClinic()?.id !== clinicId) return;
      this.providers.set([]);
      this.operatories.set([]);
      this.resourceError.set('Les ressources du planning ne peuvent pas être chargées.');
    } finally {
      if (requestSequence === this.resourceLoadSequence && this.tenant.activeClinic()?.id === clinicId) this.loadingResources.set(false);
    }
  }

  retryResources(): void {
    const clinic = this.tenant.activeClinic();
    if (!clinic) return;
    this.resourceOptionsClinicId = '';
    void this.loadResources(clinic.organizationId, clinic.id);
    this.resourceOptionsClinicId = clinic.id;
  }

  async createProvider(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic || this.resourceSaving() || !this.providerName.trim()) return;
    const mutationSequence = ++this.resourceMutationSequence;
    this.resourceSaving.set(true);
    this.resourceError.set('');
    try {
      const provider = await this.resourcesApi.createProvider(clinic.organizationId, clinic.id, {
        displayName: this.providerName.trim(), role: this.providerRole,
      });
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.providerName = '';
      this.hoursProviderId = provider.id;
      await this.loadResources(clinic.organizationId, clinic.id);
      this.success.set('Praticien ajouté. Configurez ses horaires avant de lui attribuer des rendez-vous.');
    } catch {
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.resourceError.set('Le praticien n’a pas pu être ajouté. Vérifiez le nom et réessayez.');
    } finally {
      if (mutationSequence === this.resourceMutationSequence) this.resourceSaving.set(false);
    }
  }

  async createOperatory(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic || this.resourceSaving() || !this.operatoryName.trim()) return;
    const parsedChair = this.chairNumber.trim() ? Number(this.chairNumber) : null;
    if (parsedChair !== null && (!Number.isInteger(parsedChair) || parsedChair < 1 || parsedChair > 999)) {
      this.resourceError.set('Le numéro de fauteuil doit être compris entre 1 et 999.');
      return;
    }
    const mutationSequence = ++this.resourceMutationSequence;
    this.resourceSaving.set(true);
    this.resourceError.set('');
    try {
      await this.resourcesApi.createOperatory(clinic.organizationId, clinic.id, {
        name: this.operatoryName.trim(), chairNumber: parsedChair,
      });
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.operatoryName = '';
      this.chairNumber = '';
      await this.loadResources(clinic.organizationId, clinic.id);
      this.success.set('Fauteuil ajouté au planning.');
    } catch {
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.resourceError.set('Le fauteuil n’a pas pu être ajouté. Vérifiez le nom (il doit être unique dans cette clinique).');
    } finally {
      if (mutationSequence === this.resourceMutationSequence) this.resourceSaving.set(false);
    }
  }

  syncHoursDraft(): void {
    const provider = this.providers().find((item) => item.id === this.hoursProviderId);
    for (const day of this.weekdays) {
      const existing = provider?.workingHours.find((hour) => hour.dayOfWeek === day.dayOfWeek);
      day.enabled = Boolean(existing);
      day.startsAt = existing?.startsAt ?? '09:00';
      day.endsAt = existing?.endsAt ?? (day.dayOfWeek === 0 || day.dayOfWeek === 6 ? '13:00' : '18:00');
    }
  }

  async saveProviderHours(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    const provider = this.providers().find((item) => item.id === this.hoursProviderId);
    if (!clinic || !provider || this.resourceSaving()) return;
    const hours: ProviderWorkingHour[] = this.weekdays.filter((day) => day.enabled).map((day) => ({
      dayOfWeek: day.dayOfWeek, startsAt: day.startsAt, endsAt: day.endsAt,
    }));
    if (hours.some((hour) => hour.endsAt <= hour.startsAt)) {
      this.resourceError.set('Pour chaque journée activée, l’heure de fin doit être après l’heure de début.');
      return;
    }
    const mutationSequence = ++this.resourceMutationSequence;
    this.resourceSaving.set(true);
    this.resourceError.set('');
    try {
      await this.resourcesApi.saveWorkingHours(clinic.organizationId, clinic.id, provider.id, hours);
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      await this.loadResources(clinic.organizationId, clinic.id);
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.success.set('Horaires du praticien enregistrés.');
    } catch {
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.resourceError.set('Les horaires n’ont pas tous été enregistrés. Rechargez les ressources et vérifiez le planning.');
    } finally {
      if (mutationSequence === this.resourceMutationSequence) this.resourceSaving.set(false);
    }
  }

  private async loadPatientOptions(organizationId: string, clinicId: string): Promise<void> {
    const requestSequence = ++this.patientOptionsLoadSequence;
    this.loadingPatients.set(true);
    this.patientsError.set('');
    try {
      const response = await this.patientsApi.list(organizationId, clinicId);
      if (requestSequence !== this.patientOptionsLoadSequence || this.tenant.activeClinic()?.id !== clinicId) return;
      this.patients.set(response.data);
    } catch {
      if (requestSequence !== this.patientOptionsLoadSequence || this.tenant.activeClinic()?.id !== clinicId) return;
      this.patients.set([]);
      this.patientsError.set('La liste des patients ne peut pas être chargée. Vous devez pouvoir accéder aux dossiers pour planifier un rendez-vous.');
    } finally {
      if (requestSequence === this.patientOptionsLoadSequence && this.tenant.activeClinic()?.id === clinicId) this.loadingPatients.set(false);
    }
  }

  openCreateAtTime(selection: CalendarSlotSelection): void {
    if (this.saving() || this.changingStatusId()) return;
    this.openCreateForm();
    if (!selection.startsAt) return;
    this.startsAt = selection.startsAt;
    if (selection.providerId) this.providerId = selection.providerId;
    if (selection.operatoryId) this.operatoryId = selection.operatoryId;
    const [datePart, timePart] = selection.startsAt.split('T');
    const [hour, minute] = timePart.split(':').map(Number);
    const end = new Date(Date.UTC(2000, 0, 1, hour, minute + 30));
    this.endsAt = `${datePart}T${String(end.getUTCHours()).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')}`;
  }

  openCreateForm(): void {
    if (this.saving() || this.changingStatusId()) return;
    const date = this.selectedDate();
    if (!date) return;
    this.formError.set('');
    this.success.set('');
    this.patientId = '';
    this.startsAt = `${date}T09:00`;
    this.endsAt = `${date}T09:30`;
    this.reason = '';
    this.providerId = '';
    this.operatoryId = '';
    this.showCreateForm.set(true);
  }

  async createAppointment(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic || this.saving()) return;
    this.formError.set('');
    this.success.set('');
    const mutationSequence = ++this.appointmentMutationSequence;
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
        ...(this.providerId && this.operatoryId ? { providerId: this.providerId, operatoryId: this.operatoryId } : {}),
      });
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.showCreateForm.set(false);
      this.success.set('Le rendez-vous a été enregistré.');
      const createdDate = toClinicDateTimeInput(created.startsAt, timezone).slice(0, 10);
      if (createdDate !== this.selectedDate()) this.selectedDate.set(createdDate);
      else await this.loadAppointments(clinic.organizationId, clinic.id, this.selectedDate(), timezone);
    } catch (error) {
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.formError.set(error instanceof Error && !(error instanceof HttpErrorResponse)
        ? error.message
        : error instanceof HttpErrorResponse && error.status === 409
          ? error.error?.error?.message || 'Ce créneau entre en conflit avec un rendez-vous, un praticien ou un fauteuil. Choisissez une autre heure.'
          : error instanceof HttpErrorResponse && error.status === 404
            ? 'Le patient n’est pas accessible dans la clinique active. Rechargez la liste.'
            : error instanceof HttpErrorResponse && error.status === 403
              ? 'Votre rôle ne permet pas de planifier un rendez-vous.'
              : 'Le rendez-vous n’a pas été enregistré. Vérifiez les horaires puis réessayez.');
    } finally {
      if (mutationSequence === this.appointmentMutationSequence) this.saving.set(false);
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
    if (this.saving() || this.changingStatusId()) return;
    const timezone = this.tenant.activeClinic()?.timezone || 'Africa/Casablanca';
    this.reschedulingId.set(appointment.id);
    this.rescheduleError.set('');
    this.rescheduleStartsAt = toClinicDateTimeInput(appointment.startsAt, timezone);
    this.rescheduleEndsAt = toClinicDateTimeInput(appointment.endsAt, timezone);
    this.rescheduleProviderId = appointment.providerId ?? '';
    this.rescheduleOperatoryId = appointment.operatoryId ?? '';
  }

  async dropAppointment(change: CalendarAppointmentDrop): Promise<void> {
    const clinic = this.tenant.activeClinic();
    const appointment = change.appointment;
    if (!clinic || this.saving() || !this.canReschedule(appointment.status)) return;
    const timezone = clinic.timezone || 'Africa/Casablanca';
    const startsAt = localDateTimeToIso(change.startsAt, timezone);
    const durationMs = new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime();
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;
    const endsAt = new Date(new Date(startsAt).getTime() + durationMs).toISOString();
    const mutationSequence = ++this.appointmentMutationSequence;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await this.appointmentsApi.reschedule(
        clinic.organizationId,
        clinic.id,
        appointment.id,
        startsAt,
        endsAt,
        change.providerId !== undefined ? change.providerId : appointment.providerId,
        change.operatoryId !== undefined ? change.operatoryId : appointment.operatoryId,
      );
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.success.set('Le rendez-vous a été déplacé.');
      await this.loadAppointments(clinic.organizationId, clinic.id, this.selectedDate(), timezone);
    } catch (error) {
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      await this.loadAppointments(clinic.organizationId, clinic.id, this.selectedDate(), timezone);
      this.error.set(error instanceof HttpErrorResponse && error.status === 409
        ? 'Ce déplacement crée un conflit de planning. Le rendez-vous a conservé son horaire initial.'
        : 'Le déplacement n’a pas été enregistré. Le rendez-vous a conservé son horaire initial.');
    } finally {
      if (mutationSequence === this.appointmentMutationSequence) this.saving.set(false);
    }
  }

  async saveReschedule(appointment: AppointmentRecord): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic || this.saving()) return;
    this.rescheduleError.set('');
    const mutationSequence = ++this.appointmentMutationSequence;
    this.saving.set(true);
    try {
      const timezone = clinic.timezone || 'Africa/Casablanca';
      const startsAt = localDateTimeToIso(this.rescheduleStartsAt, timezone);
      const endsAt = localDateTimeToIso(this.rescheduleEndsAt, timezone);
      await this.appointmentsApi.reschedule(clinic.organizationId, clinic.id, appointment.id, startsAt, endsAt, this.rescheduleProviderId || null, this.rescheduleOperatoryId || null);
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.reschedulingId.set(null);
      this.success.set('Le rendez-vous a été déplacé.');
      const rescheduledDate = toClinicDateTimeInput(startsAt, timezone).slice(0, 10);
      if (rescheduledDate !== this.selectedDate()) this.selectedDate.set(rescheduledDate);
      else await this.loadAppointments(clinic.organizationId, clinic.id, this.selectedDate(), timezone);
    } catch (error) {
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.rescheduleError.set(error instanceof Error && !(error instanceof HttpErrorResponse)
        ? error.message
        : error instanceof HttpErrorResponse && error.status === 409
          ? 'Le créneau n’est plus disponible ou le rendez-vous ne peut plus être déplacé.'
          : 'Le déplacement n’a pas été enregistré. Vérifiez les horaires puis réessayez.');
    } finally {
      if (mutationSequence === this.appointmentMutationSequence) this.saving.set(false);
    }
  }

  requestStatusChange(appointment: AppointmentRecord, status: Exclude<AppointmentStatus, 'SCHEDULED'>): void {
    if (this.saving() || this.changingStatusId()) return;
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
    if (!clinic || this.saving() || this.changingStatusId()) return;
    const mutationSequence = ++this.statusMutationSequence;
    this.changingStatusId.set(appointment.id);
    this.error.set('');
    this.success.set('');
    try {
      await this.appointmentsApi.changeStatus(clinic.organizationId, clinic.id, appointment.id, status);
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.success.set(`Statut mis à jour : ${this.statusLabel(status).toLowerCase()}.`);
      await this.loadAppointments(clinic.organizationId, clinic.id, this.selectedDate(), clinic.timezone || 'Africa/Casablanca');
    } catch (error) {
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.error.set(error instanceof HttpErrorResponse && error.status === 409
        ? 'Le statut a changé ou cette transition n’est plus autorisée. Rechargez l’agenda.'
        : 'Le statut n’a pas été modifié. Réessayez.');
    } finally {
      if (mutationSequence === this.statusMutationSequence) this.changingStatusId.set(null);
    }
  }

  moveDate(days: number): void {
    const current = this.selectedDate();
    if (current) this.selectedDate.set(addCalendarDays(current, days));
  }
}
