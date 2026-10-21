import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { PatientApiService } from '../patients/patient-api.service';
import type { PatientListRecord } from '../patients/patient-api.service';
import { AppointmentApiService } from './appointment-api.service';
import { SchedulerCalendarComponent } from './calendar-engine/scheduler-calendar.component';
import type { CalendarCategory, CalendarEvent, CalendarGateway, CalendarViewType, EventDraft, LaneConfig } from './calendar-engine/models/calendar.models';
import type { IconName } from './calendar-engine/components/cal-icon/cal-icon.component';
import { SchedulingResourceApiService } from './scheduling-resource-api.service';
import type { ClinicOperatory, ClinicProvider, ProviderRole, ProviderWorkingHour } from './scheduling-resource-api.service';
import type { AppointmentRecord, AppointmentStatus } from './appointment-api.service';
import { addCalendarDays, formatCalendarDate as formatCalendarDateValue, formatClinicDate, formatClinicTime, localDateTimeToIso, todayInTimeZone, toClinicDateTimeInput } from './clinic-date-time';

interface CalendarSlotSelection {
  startsAt: string;
  endsAt?: string;
  providerId?: string;
  operatoryId?: string;
}

@Component({
  selector: 'app-agenda-page',
  imports: [FormsModule, RouterLink, SchedulerCalendarComponent],
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
  readonly calendarView = signal<CalendarViewType>('week');
  readonly calendarResourceView = signal<'all' | 'provider' | 'operatory'>('all');
  readonly dayAppointments = computed(() => {
    const zone = this.tenant.activeClinic()?.timezone || 'Africa/Casablanca';
    return this.appointments().filter((appointment) => toClinicDateTimeInput(appointment.startsAt, zone).slice(0, 10) === this.selectedDate());
  });
  readonly appointments = signal<AppointmentRecord[]>([]);
  readonly calendarCategories = computed<CalendarCategory[]>(() => [
    { id: 'SCHEDULED', name: 'Planifié', color: '#64748b', visible: true },
    { id: 'CONFIRMED', name: 'Confirmé', color: '#2563eb', visible: true },
    { id: 'ARRIVED', name: 'Arrivé', color: '#d97706', visible: true },
    { id: 'IN_PROGRESS', name: 'En soin', color: '#0f9f8f', visible: true },
    { id: 'COMPLETED', name: 'Terminé', color: '#16a34a', visible: true },
    { id: 'CANCELLED', name: 'Annulé', color: '#94a3b8', visible: true },
    { id: 'NO_SHOW', name: 'Absent', color: '#dc2626', visible: true },
  ]);
  readonly calendarEvents = computed<CalendarEvent[]>(() => {
    const zone = this.tenant.activeClinic()?.timezone || 'Africa/Casablanca';
    return this.appointments().map((appointment) => {
      const meta = this.calendarStatusMeta(appointment.status);
      return {
        id: appointment.id,
        title: `${appointment.patientFirstName} ${appointment.patientLastName}`.trim(),
        start: this.calendarDateFromInput(toClinicDateTimeInput(appointment.startsAt, zone)),
        end: this.calendarDateFromInput(toClinicDateTimeInput(appointment.endsAt, zone)),
        allDay: false,
        calendarId: appointment.status,
        location: appointment.operatoryName || undefined,
        notes: [appointment.reason, appointment.providerName, appointment.operatoryName, appointment.patientNumber].filter(Boolean).join(' · ') || undefined,
        subtitle: [appointment.reason, appointment.providerName].filter(Boolean).join(' · ') || this.statusLabel(appointment.status),
        resources: { provider: appointment.providerId || 'unassigned', operatory: appointment.operatoryId || 'unassigned' },
        badge: { icon: meta.icon, label: meta.label },
        tone: meta.tone,
        locked: !this.canReschedule(appointment.status),
        lockedReason: this.canReschedule(appointment.status) ? undefined : 'Ce rendez-vous ne peut plus être déplacé.',
      };
    });
  });
  readonly calendarLanes = computed<LaneConfig | null>(() => {
    const mode = this.calendarResourceView();
    if (mode === 'all') return null;
    if (mode === 'provider') return {
      dimension: 'provider',
      lanes: [
        { id: 'unassigned', label: 'Non affectés', sublabel: 'Sans praticien ni fauteuil' },
        ...this.providers().map((provider) => ({ id: provider.id, label: provider.displayName })),
      ],
    };
    return {
      dimension: 'operatory',
      lanes: [
        { id: 'unassigned', label: 'Non affectés', sublabel: 'Sans praticien ni fauteuil' },
        ...this.operatories().map((operatory) => ({ id: operatory.id, label: operatory.name })),
      ],
    };
  });
  readonly calendarGateway: CalendarGateway = {
    update: async (event, previous) => this.persistCalendarMove(event, previous),
  };
  readonly patients = signal<PatientListRecord[]>([]);
  readonly waitingRoomAppointments = computed(() => this.dayAppointments().filter((appointment) => appointment.status === 'ARRIVED'));
  readonly inTreatmentAppointments = computed(() => this.dayAppointments().filter((appointment) => appointment.status === 'IN_PROGRESS'));
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
  reschedulePatientId = '';
  rescheduleReason = '';

  constructor() {
    effect(() => {
      const clinic = this.tenant.activeClinic();
      if (!clinic) {
        if (!this.activeClinicId) return;
        this.activeClinicId = '';
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
        this.selectedDate.set('');
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
        this.reschedulePatientId = '';
        this.rescheduleReason = '';
        this.patientOptionsClinicId = '';
        this.resourceOptionsClinicId = '';
        return;
      }
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
      this.reschedulePatientId = '';
      this.rescheduleReason = '';
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
      const view = this.calendarView();
      if (!date) {
        this.selectedDate.set(todayInTimeZone(clinic.timezone || 'Africa/Casablanca'));
        return;
      }
      void this.loadAppointments(clinic.organizationId, clinic.id, date, clinic.timezone || 'Africa/Casablanca', view);
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

  private async loadAppointments(organizationId: string, clinicId: string, date: string, timeZone: string, view: 'day' | 'week' | 'month' | 'year' = this.calendarView(), preserveExisting = false): Promise<void> {
    const requestSequence = ++this.appointmentLoadSequence;
    this.loading.set(true);
    if (!preserveExisting) this.appointments.set([]);
    this.pendingStatusChange.set(null);
    this.error.set('');
    try {
      const range = this.appointmentRange(date, view);
      const from = localDateTimeToIso(`${range.from}T00:00`, timeZone);
      const to = localDateTimeToIso(`${range.to}T00:00`, timeZone);
      const response = await this.appointmentsApi.list(organizationId, clinicId, from, to);
      if (requestSequence !== this.appointmentLoadSequence || this.tenant.activeClinic()?.id !== clinicId || this.selectedDate() !== date) return;
      this.appointments.set(response.data);
    } catch (error) {
      if (requestSequence !== this.appointmentLoadSequence || this.tenant.activeClinic()?.id !== clinicId || this.selectedDate() !== date) return;
      if (!preserveExisting) this.appointments.set([]);
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
      this.resourceError.set('Les horaires n’ont pas été enregistrés. Vérifiez les horaires puis réessayez.');
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
    if (selection.endsAt) {
      this.endsAt = selection.endsAt;
      return;
    }
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
    if (Boolean(this.providerId) !== Boolean(this.operatoryId)) {
      this.formError.set('Affectez à la fois un praticien et un fauteuil, ou laissez les deux champs vides.');
      return;
    }
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
        ...(this.providerId ? { providerId: this.providerId } : {}),
        ...(this.operatoryId ? { operatoryId: this.operatoryId } : {}),
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


  calendarStatusMeta(status: AppointmentStatus): { icon: IconName; label: string; tone: NonNullable<CalendarEvent['tone']> } {
    const metadata: Record<AppointmentStatus, { icon: IconName; label: string; tone: NonNullable<CalendarEvent['tone']> }> = {
      SCHEDULED: { icon: 'calendar', label: 'Planifié', tone: 'normal' },
      CONFIRMED: { icon: 'circle-check', label: 'Confirmé', tone: 'normal' },
      ARRIVED: { icon: 'clock', label: 'Arrivé', tone: 'attention' },
      IN_PROGRESS: { icon: 'play', label: 'En soin', tone: 'active' },
      COMPLETED: { icon: 'circle-check', label: 'Terminé', tone: 'done' },
      CANCELLED: { icon: 'ban', label: 'Annulé', tone: 'muted' },
      NO_SHOW: { icon: 'user-x', label: 'Absent', tone: 'muted' },
    };
    return metadata[status];
  }

  setCalendarResourceView(mode: 'all' | 'provider' | 'operatory'): void {
    this.calendarResourceView.set(mode);
    if (mode !== 'all' && this.calendarView() !== 'day') this.calendarView.set('day');
  }

  onCalendarDateChanged(date: string): void {
    if (date && date !== this.selectedDate()) this.selectedDate.set(date);
  }

  onCalendarViewChanged(view: CalendarViewType): void {
    if (view !== 'day' && this.calendarResourceView() !== 'all') this.calendarResourceView.set('all');
    if (view !== this.calendarView()) this.calendarView.set(view);
  }

  onCalendarCreateRequested(draft: EventDraft): void {
    const startsAt = this.calendarDateTimeInput(draft.start);
    this.selectedDate.set(startsAt.slice(0, 10));
    const selection: CalendarSlotSelection = {
      startsAt,
      endsAt: this.calendarDateTimeInput(draft.end),
      ...(draft.resources?.['provider'] && draft.resources['provider'] !== 'unassigned' ? { providerId: draft.resources['provider'] } : {}),
      ...(draft.resources?.['operatory'] && draft.resources['operatory'] !== 'unassigned' ? { operatoryId: draft.resources['operatory'] } : {}),
    };
    this.openCreateAtTime(selection);
  }

  onCalendarEventSelected(event: CalendarEvent): void {
    const appointment = this.appointments().find((item) => item.id === event.id);
    if (!appointment) return;
    const zone = this.tenant.activeClinic()?.timezone || 'Africa/Casablanca';
    const appointmentDate = toClinicDateTimeInput(appointment.startsAt, zone).slice(0, 10);
    if (appointmentDate !== this.selectedDate()) this.selectedDate.set(appointmentDate);
    if (!this.canReschedule(appointment.status)) {
      this.success.set('Ce rendez-vous est clôturé et ne peut plus être modifié.');
      return;
    }
    this.openReschedule(appointment);
  }

  private calendarDateFromInput(value: string): Date {
    const [date, time = '00:00'] = value.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute);
  }

  private calendarDateTimeInput(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }

  private async persistCalendarMove(event: CalendarEvent, _previous: CalendarEvent): Promise<{ ok: true } | { ok: false; code: 'conflict' | 'invalid' | 'forbidden' | 'not-found' | 'error'; message: string }> {
    const clinic = this.tenant.activeClinic();
    const appointment = this.appointments().find((item) => item.id === event.id);
    if (!clinic || !appointment) return { ok: false, code: 'not-found', message: 'Ce rendez-vous n’est plus disponible dans cette clinique.' };
    if (!this.canReschedule(appointment.status)) return { ok: false, code: 'forbidden', message: 'Le statut de ce rendez-vous ne permet plus de le déplacer.' };
    const zone = clinic.timezone || 'Africa/Casablanca';
    const clearsAssignment = event.resources?.['provider'] === 'unassigned'
      || event.resources?.['operatory'] === 'unassigned';
    const providerId = clearsAssignment
      ? null
      : event.resources?.['provider'] ?? appointment.providerId;
    const operatoryId = clearsAssignment
      ? null
      : event.resources?.['operatory'] ?? appointment.operatoryId;
    if ((providerId && !operatoryId) || (!providerId && operatoryId)) {
      return {
        ok: false,
        code: 'invalid',
        message: 'Pour affecter ce rendez-vous, choisissez à la fois un praticien et un fauteuil dans le formulaire.',
      };
    }
    try {
      await this.appointmentsApi.reschedule(
        clinic.organizationId,
        clinic.id,
        appointment.id,
        localDateTimeToIso(this.calendarDateTimeInput(event.start), zone),
        localDateTimeToIso(this.calendarDateTimeInput(event.end), zone),
        providerId,
        operatoryId,
      );
      if (this.tenant.activeClinic()?.id === clinic.id) {
        await this.loadAppointments(clinic.organizationId, clinic.id, this.selectedDate(), zone, this.calendarView(), true);
      }
      return { ok: true };
    } catch (error) {
      const httpError = error instanceof HttpErrorResponse ? error : null;
      return {
        ok: false,
        code: httpError?.status === 409 ? 'conflict' : httpError?.status === 403 ? 'forbidden' : httpError?.status === 400 ? 'invalid' : 'error',
        message: httpError?.status === 409
          ? httpError.error?.error?.message || 'Ce créneau est déjà occupé. Le rendez-vous a été replacé à son horaire initial.'
          : httpError?.status === 403
            ? 'Votre rôle ne permet pas de déplacer ce rendez-vous.'
            : 'Le déplacement n’a pas été enregistré. Le calendrier restaure les horaires précédents.',
      };
    }
  }

  availableTransitions(status: AppointmentStatus, startsAt?: string, endsAt?: string): AppointmentStatus[] {
    const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      SCHEDULED: ['CONFIRMED', 'ARRIVED', 'CANCELLED', 'NO_SHOW'],
      CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
      ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED'],
      COMPLETED: [],
      CANCELLED: ['SCHEDULED'],
      NO_SHOW: ['SCHEDULED'],
    };
    let available = transitions[status];
    if (!endsAt || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) > Date.now()) {
      available = available.filter((next) => next !== 'NO_SHOW');
    }
    if (!startsAt || !available.includes('ARRIVED')) return available;
    const clinic = this.tenant.activeClinic();
    const timeZone = clinic?.timezone || 'Africa/Casablanca';
    const appointmentDate = toClinicDateTimeInput(startsAt, timeZone).slice(0, 10);
    return appointmentDate === todayInTimeZone(timeZone)
      ? available
      : available.filter((next) => next !== 'ARRIVED');
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
    this.reschedulePatientId = appointment.patientId;
    this.rescheduleReason = appointment.reason ?? '';
  }


  async saveReschedule(appointment: AppointmentRecord): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic || this.saving()) return;
    this.rescheduleError.set('');
    if (!this.reschedulePatientId) {
      this.rescheduleError.set('Sélectionnez un patient pour ce rendez-vous.');
      return;
    }
    if (Boolean(this.rescheduleProviderId) !== Boolean(this.rescheduleOperatoryId)) {
      this.rescheduleError.set('Affectez à la fois un praticien et un fauteuil, ou laissez les deux champs vides.');
      return;
    }
    const mutationSequence = ++this.appointmentMutationSequence;
    this.saving.set(true);
    try {
      const timezone = clinic.timezone || 'Africa/Casablanca';
      const startsAt = localDateTimeToIso(this.rescheduleStartsAt, timezone);
      const endsAt = localDateTimeToIso(this.rescheduleEndsAt, timezone);
      await this.appointmentsApi.update(clinic.organizationId, clinic.id, appointment.id, {
        startsAt,
        endsAt,
        providerId: this.rescheduleProviderId || null,
        operatoryId: this.rescheduleOperatoryId || null,
        patientId: this.reschedulePatientId,
        reason: this.rescheduleReason.trim() || null,
      });
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.reschedulingId.set(null);
      this.success.set('Les modifications du rendez-vous ont été enregistrées.');
      const rescheduledDate = toClinicDateTimeInput(startsAt, timezone).slice(0, 10);
      if (rescheduledDate !== this.selectedDate()) this.selectedDate.set(rescheduledDate);
      else await this.loadAppointments(clinic.organizationId, clinic.id, this.selectedDate(), timezone);
    } catch (error) {
      if (this.tenant.activeClinic()?.id !== clinic.id) return;
      this.rescheduleError.set(error instanceof Error && !(error instanceof HttpErrorResponse)
        ? error.message
        : error instanceof HttpErrorResponse && error.status === 409
          ? error.error?.error?.message || 'Le créneau n’est plus disponible ou le rendez-vous ne peut plus être modifié.'
          : error instanceof HttpErrorResponse && error.status === 404
            ? 'Le patient sélectionné n’est pas accessible dans la clinique active. Rechargez la liste.'
            : error instanceof HttpErrorResponse && error.status === 400
              ? error.error?.error?.message || 'Vérifiez les horaires et les ressources sélectionnées.'
              : 'Les modifications n’ont pas été enregistrées. Vérifiez les horaires puis réessayez.');
    } finally {
      if (mutationSequence === this.appointmentMutationSequence) this.saving.set(false);
    }
  }

  requestStatusChange(appointment: AppointmentRecord, status: AppointmentStatus): void {
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

  async changeStatus(appointment: AppointmentRecord, status: AppointmentStatus): Promise<void> {
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
        ? error.error?.error?.message || 'Le statut a changé ou cette transition n’est plus autorisée. Rechargez l’agenda.'
        : 'Le statut n’a pas été modifié. Réessayez.');
    } finally {
      if (mutationSequence === this.statusMutationSequence) this.changingStatusId.set(null);
    }
  }

  private appointmentRange(date: string, view: 'day' | 'week' | 'month' | 'year'): { from: string; to: string } {
    if (view === 'week') {
      const offset = (new Date(date + 'T12:00:00').getDay() + 6) % 7;
      const from = addCalendarDays(date, -offset);
      return { from, to: addCalendarDays(from, 7) };
    }
    if (view === 'month') {
      const firstOfMonth = date.slice(0, 7) + '-01';
      const weekdayOffset = (new Date(firstOfMonth + 'T12:00:00').getDay() + 6) % 7;
      const from = addCalendarDays(firstOfMonth, -weekdayOffset);
      return { from, to: addCalendarDays(from, 42) };
    }
    if (view === 'year') {
      const year = Number(date.slice(0, 4));
      return { from: year + '-01-01', to: (year + 1) + '-01-01' };
    }
    return { from: date, to: addCalendarDays(date, 1) };
  }


}
