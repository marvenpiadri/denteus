import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { AppointmentRecord } from './appointment-api.service';

@Component({
  selector: 'app-agenda-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agenda-calendar.component.html',
  styleUrl: './agenda-calendar.component.css',
})
export class AgendaCalendarComponent {
  @Input() appointments: AppointmentRecord[] = [];
  @Input() date = '';
  @Input() timeZone = 'Africa/Casablanca';
  @Input() loading = false;
  @Output() slotSelected = new EventEmitter<string>();
  @Output() appointmentSelected = new EventEmitter<AppointmentRecord>();

  readonly hours = Array.from({ length: 13 }, (_, index) => index + 7);

  appointmentsAt(hour: number): AppointmentRecord[] {
    return this.appointments.filter((appointment) => this.localHour(appointment.startsAt) === hour);
  }

  localHour(value: string): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: this.timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(value));
    return Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  }

  time(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: this.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
  }

  patientName(appointment: AppointmentRecord): string {
    return [appointment.patientFirstName, appointment.patientLastName].filter(Boolean).join(' ');
  }

  statusLabel(status: AppointmentRecord['status']): string {
    const labels: Record<AppointmentRecord['status'], string> = {
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

  selectSlot(hour: number): void {
    if (!this.date || this.loading) return;
    this.slotSelected.emit(`${this.date}T${String(hour).padStart(2, '0')}:00`);
  }
}
