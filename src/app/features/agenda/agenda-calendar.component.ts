import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import type { AppointmentRecord } from './appointment-api.service';
import type { ClinicOperatory, ClinicProvider } from './scheduling-resource-api.service';

export type CalendarResourceMode = 'day' | 'provider' | 'operatory';
export interface CalendarResourceColumn { key: string; id: string | null; label: string; kind: 'all' | 'unassigned' | 'provider' | 'operatory'; }
export interface PositionedCalendarAppointment { appointment: AppointmentRecord; topPx: number; heightPx: number; leftPct: number; widthPct: number; }
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

  positionedAppointments(column: CalendarResourceColumn): PositionedCalendarAppointment[] {
    const visibleStart = 7 * 60;
    const visibleEnd = 20 * 60;
    const matching = this.appointments.map((appointment) => ({
      appointment,
      start: this.localMinutes(appointment.startsAt),
      end: this.localDate(appointment.endsAt) === this.date ? this.localMinutes(appointment.endsAt) : visibleEnd,
    })).filter((item) => {
      if (this.localDate(item.appointment.startsAt) !== this.date) return false;
      if (item.end <= visibleStart || item.start >= visibleEnd) return false;
      if (column.kind === 'all') return true;
      if (column.kind === 'unassigned') return this.viewMode() === 'provider'
        ? !item.appointment.providerId
        : !item.appointment.operatoryId;
      return column.kind === 'provider'
        ? item.appointment.providerId === column.id
        : item.appointment.operatoryId === column.id;
    }).sort((a, b) => a.start - b.start || a.end - b.end);

    const result: PositionedCalendarAppointment[] = [];
    let cursor = 0;
    while (cursor < matching.length) {
      const cluster = [matching[cursor]];
      let clusterEnd = matching[cursor].end;
      let next = cursor + 1;
      while (next < matching.length && matching[next].start < clusterEnd) {
        cluster.push(matching[next]);
        clusterEnd = Math.max(clusterEnd, matching[next].end);
        next++;
      }
      const laneEnds: number[] = [];
      const placed: Array<{ item: typeof matching[number]; lane: number }> = [];
      for (const item of cluster) {
        let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.start);
        if (lane < 0) {
          lane = laneEnds.length;
          laneEnds.push(item.end);
        } else {
          laneEnds[lane] = item.end;
        }
        placed.push({ item, lane });
      }
      const laneCount = Math.max(1, laneEnds.length);
      for (const { item, lane } of placed) {
        const clippedStart = Math.max(item.start, visibleStart);
        const clippedEnd = Math.min(item.end, visibleEnd);
        result.push({
          appointment: item.appointment,
          topPx: clippedStart - visibleStart,
          heightPx: Math.max(28, clippedEnd - clippedStart),
          leftPct: (lane / laneCount) * 100,
          widthPct: Math.max(12, (100 / laneCount) - 1.5),
        });
      }
      cursor = next;
    }
    return result;
  }

  private localDate(value: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(value));
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private localMinutes(value: string): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: this.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(value));
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
    return hour * 60 + minute;
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
