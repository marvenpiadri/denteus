import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import type { AppointmentRecord } from './appointment-api.service';
import type { ClinicOperatory, ClinicProvider } from './scheduling-resource-api.service';

export type CalendarResourceMode = 'day' | 'provider' | 'operatory';
export interface CalendarResourceColumn { key: string; id: string | null; label: string; kind: 'all' | 'unassigned' | 'provider' | 'operatory'; }
export interface CalendarSlotSelection {
  startsAt: string;
  providerId?: string;
  operatoryId?: string;
}

@Component({
  selector: 'app-agenda-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agenda-calendar.component.html',
  styleUrl: './agenda-calendar.component.css',
})
export class AgendaCalendarComponent {
  @Input() appointments: AppointmentRecord[] = [];
  @Input() providers: ClinicProvider[] = [];
  @Input() operatories: ClinicOperatory[] = [];
  @Input() date = '';
  @Input() timeZone = 'Africa/Casablanca';
  @Input() loading = false;
  @Output() slotSelected = new EventEmitter<CalendarSlotSelection>();
  @Output() appointmentSelected = new EventEmitter<AppointmentRecord>();

  readonly viewMode = signal<CalendarResourceMode>('day');
  readonly hours = Array.from({ length: 13 }, (_, index) => index + 7);

  get resourceCount(): number {
    if (this.viewMode() === 'provider') return this.providers.length + 1;
    if (this.viewMode() === 'operatory') return this.operatories.length + 1;
    return 1;
  }

  columns(): CalendarResourceColumn[] {
    if (this.viewMode() === 'day') return [{ key: 'all', id: null, label: 'Rendez-vous', kind: 'all' }];
    if (this.viewMode() === 'provider') return [
      { key: 'unassigned', id: null, label: 'Non affectés', kind: 'unassigned' },
      ...this.providers.map((provider) => ({ key: provider.id, id: provider.id, label: provider.displayName, kind: 'provider' as const })),
    ];
    return [
      { key: 'unassigned', id: null, label: 'Non affectés', kind: 'unassigned' },
      ...this.operatories.map((operatory) => ({ key: operatory.id, id: operatory.id, label: operatory.name, kind: 'operatory' as const })),
    ];
  }

  appointmentsAt(hour: number, column: CalendarResourceColumn): AppointmentRecord[] {
    return this.appointments.filter((appointment) => {
      if (this.localHour(appointment.startsAt) !== hour) return false;
      if (column.kind === 'all') return true;
      if (column.kind === 'unassigned') return this.viewMode() === 'provider'
        ? !appointment.providerId
        : !appointment.operatoryId;
      return column.kind === 'provider'
        ? appointment.providerId === column.id
        : appointment.operatoryId === column.id;
    });
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

  selectSlot(hour: number, column: CalendarResourceColumn): void {
    if (!this.date || this.loading) return;
    const selection: CalendarSlotSelection = {
      startsAt: `${this.date}T${String(hour).padStart(2, '0')}:00`,
    };
    if (column.kind === 'provider' && column.id) selection.providerId = column.id;
    if (column.kind === 'operatory' && column.id) selection.operatoryId = column.id;
    this.slotSelected.emit(selection);
  }

  setView(mode: CalendarResourceMode): void {
    if (mode === 'provider' && !this.providers.length) return;
    if (mode === 'operatory' && !this.operatories.length) return;
    this.viewMode.set(mode);
  }
}
