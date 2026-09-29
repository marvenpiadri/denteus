import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Appointment, AppointmentType } from '../../core/models/appointment.models';
import { CalendarResourceMode, CalendarView } from '../../core/models/calendar.models';
import { CalendarService } from '../../core/services/calendar.service';
import { DentalDataService } from '../../core/services/dental-data.service';
import { I18nService } from '../../core/services/i18n.service';
import { TenantService } from '../../core/services/tenant.service';
import { AppointmentSchedulingService } from '../../core/services/appointment-scheduling.service';

@Component({
  selector: 'app-agenda',
  imports: [CommonModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agenda.component.html',
  styleUrl: './agenda.component.css',
})
export class AgendaComponent {
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);
  readonly tenantService = inject(TenantService);
  readonly scheduling = inject(AppointmentSchedulingService);
  readonly calendar = inject(CalendarService);

  readonly view = signal<CalendarView>('week');
  readonly resourceMode = signal<CalendarResourceMode>('doctors');
  readonly anchorDate = signal(new Date());
  readonly selectedAppointment = signal<Appointment | null>(null);
  readonly showNewModal = signal(false);
  readonly scheduleError = signal<string | null>(null);
  readonly draftDate = signal(this.calendar.formatDateKey(new Date()));
  readonly draggedAppointment = signal<Appointment | null>(null);

  newAptPatientId = 'pat-1';
  newAptDoctorId = 'user-1';
  newAptChairId = 'chair-1';
  newAptType: AppointmentType = 'consultation';
  newAptDuration = 30;
  newAptTime = '09:00';
  newAptReason = '';
  newAptColor = '#0d9488';

  readonly resources = computed(() => this.resourceMode() === 'doctors'
    ? this.tenantService.clinicDoctors().map((doctor) => ({
        id: doctor.id,
        name: doctor.name.replace(/^Dr\.\s*/i, ''),
        subtitle: doctor.specialty || 'Chirurgien-dentiste',
        color: doctor.color || '#0d9488',
      }))
    : this.tenantService.currentClinicChairs().map((chair) => ({
        id: chair.id,
        name: chair.name.replace(/\s*\(.*/, ''),
        subtitle: chair.roomNumber,
        color: '#0d9488',
      })));

  readonly currentLabel = computed(() => {
    const date = this.anchorDate();
    if (this.view() === 'month') return this.calendar.toDateLabel(date, { month: 'long', year: 'numeric' });
    if (this.view() === 'day') return this.calendar.toDateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' });
    const days = this.calendar.getWeekDays(date);
    return `${this.calendar.toDateLabel(days[0], { day: 'numeric', month: 'short' })} – ${this.calendar.toDateLabel(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`;
  });

  readonly weekDays = computed(() => this.calendar.getWeekDays(this.anchorDate()));
  readonly monthDays = computed(() => {
    const days = this.calendar.getMonthDays(this.anchorDate());
    const appointments = this.visibleAppointments();
    return days.map((day) => ({ ...day, appointments: appointments.filter((a) => a.startTime.startsWith(day.date)) }));
  });

  readonly timeRows = computed(() => Array.from(
    { length: ((this.calendar.dayEndHour - this.calendar.dayStartHour) * 60) / this.calendar.slotMinutes },
    (_, index) => this.calendar.dayStartHour * 60 + index * this.calendar.slotMinutes,
  ));

  readonly visibleAppointments = computed(() => {
    const clinicId = this.tenantService.currentClinicId();
    const appointments = this.dataService.appointments().filter((a) => a.clinicId === clinicId);
    if (this.view() === 'day') {
      const date = this.calendar.formatDateKey(this.anchorDate());
      return appointments.filter((a) => a.startTime.startsWith(date));
    }
    if (this.view() === 'week') {
      const start = this.calendar.formatDateKey(this.calendar.startOfWeek(this.anchorDate()));
      const end = this.calendar.formatDateKey(this.calendar.addDays(this.calendar.startOfWeek(this.anchorDate()), 7));
      return appointments.filter((a) => a.startTime >= start && a.startTime < end);
    }
    return appointments;
  });

  goToday(): void { this.anchorDate.set(new Date()); }

  previous(): void {
    const date = this.anchorDate();
    this.anchorDate.set(this.view() === 'month'
      ? new Date(date.getFullYear(), date.getMonth() - 1, 1)
      : this.calendar.addDays(date, this.view() === 'week' ? -7 : -1));
  }

  next(): void {
    const date = this.anchorDate();
    this.anchorDate.set(this.view() === 'month'
      ? new Date(date.getFullYear(), date.getMonth() + 1, 1)
      : this.calendar.addDays(date, this.view() === 'week' ? 7 : 1));
  }

  appointmentsForResource(resourceId: string, date: Date): Appointment[] {
    const key = this.calendar.formatDateKey(date);
    return this.visibleAppointments().filter((a) =>
      a.startTime.startsWith(key) &&
      (this.resourceMode() === 'doctors' ? a.doctorId === resourceId : a.chairId === resourceId),
    );
  }

  appointmentsForResourceDay(date: Date): Appointment[] {
    return this.visibleAppointments().filter((a) => a.startTime.startsWith(this.calendar.formatDateKey(date)));
  }

  colorFor(appointment: Appointment): string {
    if (appointment.color) return appointment.color;
    if (appointment.doctorColor) return appointment.doctorColor;
    const palette: Record<AppointmentType, string> = {
      consultation: '#0d9488', soin: '#2563eb', detartrage: '#14b8a6', endodontie: '#8b5cf6',
      prothese: '#f59e0b', chirurgie: '#e11d48', urgence: '#dc2626', controle: '#64748b',
    };
    return palette[appointment.appointmentType];
  }

  statusLabel(status: Appointment['status']): string {
    return { booked: 'Planifié', confirmed: 'Confirmé', arrived: 'Arrivé', in_treatment: 'Au fauteuil',
      completed: 'Terminé', cancelled: 'Annulé', no_show: 'Absent' }[status];
  }

  selectAppointment(appointment: Appointment): void { this.selectedAppointment.set(appointment); }

  startDrag(appointment: Appointment): void {
    this.draggedAppointment.set(appointment);
  }

  clearDrag(): void {
    this.draggedAppointment.set(null);
  }

  dropAppointment(event: DragEvent, date: Date, time: string, resourceId?: string): void {
    event.preventDefault();
    const appointment = this.draggedAppointment();
    this.draggedAppointment.set(null);
    if (!appointment) return;

    const start = this.calendar.parseLocalDate(`${this.calendar.formatDateKey(date)}T${time}:00`);
    const duration = Math.max(15, appointment.durationMinutes);
    const end = new Date(start.getTime() + duration * 60000);
    const startIso = this.calendar.localIso(start);
    const endIso = this.calendar.localIso(end);

    let doctorId = appointment.doctorId;
    let chairId = appointment.chairId;
    let doctorName = appointment.doctorName;
    let doctorColor = appointment.doctorColor;
    let chairName = appointment.chairName;

    if (this.view() === 'day' && resourceId) {
      if (this.resourceMode() === 'doctors') {
        const doctor = this.tenantService.clinicDoctors().find((item) => item.id === resourceId);
        if (doctor) {
          doctorId = doctor.id;
          doctorName = doctor.name;
          doctorColor = doctor.color;
        }
      } else {
        const chair = this.tenantService.currentClinicChairs().find((item) => item.id === resourceId);
        if (chair) {
          chairId = chair.id;
          chairName = chair.name;
        }
      }
    }

    const clinicAppointments = this.dataService.appointments().filter((item) => item.clinicId === appointment.clinicId && item.id !== appointment.id);
    if (!this.scheduling.isAvailable(clinicAppointments, startIso, endIso, doctorId, chairId)) {
      this.scheduleError.set('Ce déplacement crée un conflit avec un autre rendez-vous.');
      return;
    }

    this.dataService.updateAppointment(appointment.id, {
      startTime: startIso,
      endTime: endIso,
      doctorId,
      doctorName,
      doctorColor,
      chairId,
      chairName,
    });
  }


  changeStatus(status: Appointment['status']): void {
    const appointment = this.selectedAppointment();
    if (!appointment) return;
    this.dataService.updateAppointmentStatus(appointment.id, status);
    this.selectedAppointment.set({ ...appointment, status });
  }

  openNew(date = this.anchorDate(), time = '09:00'): void {
    this.scheduleError.set(null);
    this.draftDate.set(this.calendar.formatDateKey(date));
    this.newAptTime = time;
    this.showNewModal.set(true);
  }

  saveAppointment(): void {
    this.scheduleError.set(null);
    const patient = this.dataService.patients().find((p) => p.id === this.newAptPatientId);
    const doctor = this.tenantService.clinicDoctors().find((d) => d.id === this.newAptDoctorId);
    const chair = this.tenantService.currentClinicChairs().find((c) => c.id === this.newAptChairId);
    if (!patient || !doctor || !chair) {
      this.scheduleError.set('Sélectionnez un patient, un praticien et un fauteuil.');
      return;
    }

    const startIso = `${this.draftDate()}T${this.newAptTime}:00`;
    const start = this.calendar.parseLocalDate(startIso);
    const endIso = this.calendar.localIso(new Date(start.getTime() + this.newAptDuration * 60000));
    const clinicAppointments = this.dataService.appointments().filter((a) => a.clinicId === this.tenantService.currentClinicId());

    if (!this.scheduling.isAvailable(clinicAppointments, startIso, endIso, doctor.id, chair.id)) {
      this.scheduleError.set('Ce praticien et ce fauteuil sont déjà occupés sur ce créneau.');
      return;
    }

    this.dataService.addAppointment({
      organizationId: this.tenantService.currentOrganizationId(),
      clinicId: this.tenantService.currentClinicId(),
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientPhone: patient.phone,
      patientNumber: patient.patientNumber,
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorColor: doctor.color,
      chairId: chair.id,
      chairName: chair.name,
      appointmentType: this.newAptType,
      startTime: startIso,
      endTime: endIso,
      durationMinutes: this.newAptDuration,
      status: 'confirmed',
      reason: this.newAptReason || 'Consultation programmée',
      color: this.newAptColor,
    });

    this.showNewModal.set(false);
    this.newAptReason = '';
  }
}
