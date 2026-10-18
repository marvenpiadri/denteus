import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import type { AppointmentRecord } from './appointment-api.service';
import type { ClinicOperatory, ClinicProvider } from './scheduling-resource-api.service';

export type CalendarResourceMode = 'day' | 'provider' | 'operatory';
export type CalendarDisplayView = 'day' | 'week' | 'month' | 'year';
export interface CalendarResourceColumn { key: string; id: string | null; label: string; kind: 'all' | 'unassigned' | 'provider' | 'operatory'; }
export interface PositionedCalendarAppointment { appointment: AppointmentRecord; topPx: number; heightPx: number; leftPct: number; widthPct: number; }
export interface CalendarAppointmentDrop {
  appointment: AppointmentRecord;
  startsAt: string;
  providerId?: string | null;
  operatoryId?: string | null;
}
export interface CalendarSlotSelection {
  startsAt: string;
  providerId?: string;
  operatoryId?: string;
}

@Component({
  selector: 'app-agenda-calendar',
  standalone: true,
  imports: [CdkDrag, CdkDropList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agenda-calendar.component.html',
  styleUrl: './agenda-calendar.component.css',
})
export class AgendaCalendarComponent implements OnChanges {
  @Input() appointments: AppointmentRecord[] = [];
  @Input() providers: ClinicProvider[] = [];
  @Input() operatories: ClinicOperatory[] = [];
  @Input() date = '';
  @Input() timeZone = 'Africa/Casablanca';
  @Input() loading = false;
  /** Presentation inputs keep the calendar reusable outside the agenda page. */
  @Input() heading = 'Planning de la journée';
  @Input() description = 'Les horaires sont affichés dans le fuseau de la clinique active.';
  @Input() showHeading = true;
  @Input() allowRescheduling = true;
  @Input() initialResourceMode: CalendarResourceMode = 'day';
  @Output() slotSelected = new EventEmitter<CalendarSlotSelection>();
  @Output() appointmentSelected = new EventEmitter<AppointmentRecord>();
  @Output() appointmentDropped = new EventEmitter<CalendarAppointmentDrop>();
  @Output() viewChanged = new EventEmitter<CalendarDisplayView>();
  @Output() calendarDayPicked = new EventEmitter<string>();
  readonly displayView = signal<CalendarDisplayView>('day');
  @Output() resourceModeChange = new EventEmitter<CalendarResourceMode>();

  readonly viewMode = signal<CalendarResourceMode>('day');
  readonly hours = Array.from({ length: 13 }, (_, index) => index + 7);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialResourceMode'] && this.initialResourceMode) {
      this.setView(this.initialResourceMode, false);
    }
  }

  get resourceCount(): number {
    if (this.viewMode() === 'provider') return this.providers.length + 1;
    if (this.viewMode() === 'operatory') return this.operatories.length + 1;
    return 1;
  }

  dropListIds(): string[] {
    return this.columns().map((column) => this.dropListId(column));
  }

  dropListId(column: CalendarResourceColumn): string {
    return `agenda-lane-${column.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  appointmentsForColumn(column: CalendarResourceColumn): AppointmentRecord[] {
    return this.positionedAppointments(column).map((item) => item.appointment);
  }

  onAppointmentDrop(event: CdkDragDrop<AppointmentRecord[]>, column: CalendarResourceColumn): void {
    const appointment = event.item.data as AppointmentRecord;
    if (!appointment || ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status) || this.loading || !this.allowRescheduling) return;
    const lane = event.container.element.nativeElement;
    const laneRect = lane.getBoundingClientRect();
    const pointerOffset = event.dropPoint.y - laneRect.top - 14;
    const snappedMinutes = Math.max(0, Math.min(12 * 60 + 45, Math.round(pointerOffset / 15) * 15));
    const totalMinutes = 7 * 60 + snappedMinutes;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const startsAt = `${this.date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const durationMs = new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime();
    const originalLocalDate = this.localDate(appointment.startsAt);
    const originalLocalMinutes = this.localMinutes(appointment.startsAt);
    const targetLocalMinutes = totalMinutes;
    if (originalLocalDate === this.date && Math.abs(originalLocalMinutes - targetLocalMinutes) < 15 && column.kind === 'all') return;

    const change: CalendarAppointmentDrop = { appointment, startsAt };
    if (column.kind === 'provider') {
      change.providerId = column.id;
      change.operatoryId = appointment.operatoryId;
    } else if (column.kind === 'operatory') {
      change.operatoryId = column.id;
      change.providerId = appointment.providerId;
    } else if (column.kind === 'unassigned') {
      if (this.viewMode() === 'provider') {
        change.providerId = null;
        change.operatoryId = appointment.operatoryId;
      } else {
        change.operatoryId = null;
        change.providerId = appointment.providerId;
      }
    } else {
      change.providerId = appointment.providerId;
      change.operatoryId = appointment.operatoryId;
    }
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;
    this.appointmentDropped.emit(change);
  }

  defaultColumn(): CalendarResourceColumn {
    return this.columns()[0] ?? { key: 'all', id: null, label: 'Rendez-vous', kind: 'all' };
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
      const first = matching[cursor];
      if (!first) break;
      const cluster = [first];
      let clusterEnd = first.end;
      let next = cursor + 1;
      while (next < matching.length) {
        const candidate = matching[next];
        if (!candidate || candidate.start >= clusterEnd) break;
        cluster.push(candidate);
        clusterEnd = Math.max(clusterEnd, candidate.end);
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
          widthPct: Math.max(4, (100 / laneCount) - 1.5),
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

  setView(mode: CalendarResourceMode | CalendarDisplayView, emit = true): void {
    if (mode === 'provider' && !this.providers.length) return;
    if (mode === 'operatory' && !this.operatories.length) return;
    if (mode === 'day' || mode === 'week' || mode === 'month' || mode === 'year') {
      this.displayView.set(mode);
      this.viewMode.set('day');
      if (emit) this.viewChanged.emit(mode);
      return;
    }
    this.viewMode.set(mode);
    if (emit) this.resourceModeChange.emit(mode);
  }

  dateForOffset(days: number): string {
    const base = new Date(this.date + 'T12:00:00');
    base.setDate(base.getDate() + days);
    return this.dateString(base);
  }

  weekDates(): string[] {
    const date = new Date(this.date + 'T12:00:00');
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(date);
      day.setDate(date.getDate() + i);
      return this.dateString(day);
    });
  }

  monthDates(): Array<{ date: string; inMonth: boolean }> {
    const selected = new Date(this.date + 'T12:00:00');
    const first = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const day = new Date(first);
      day.setDate(first.getDate() + i);
      return { date: this.dateString(day), inMonth: day.getMonth() === selected.getMonth() };
    });
  }

  yearMonths(): Array<{ label: string; month: number }> {
    const year = Number(this.date.slice(0, 4));
    return Array.from({ length: 12 }, (_, month) => ({
      label: new Intl.DateTimeFormat('fr-MA', { month: 'long' }).format(new Date(year, month, 1)),
      month,
    }));
  }

  monthDatesFor(month: number): Array<{ date: string; inMonth: boolean }> {
    const year = Number(this.date.slice(0, 4));
    const first = new Date(year, month, 1, 12);
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const day = new Date(first);
      day.setDate(first.getDate() + i);
      return { date: this.dateString(day), inMonth: day.getMonth() === month };
    });
  }

  appointmentsOn(date: string): AppointmentRecord[] {
    return this.appointments.filter((appointment) => this.localDate(appointment.startsAt) === date)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  dateLabel(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric' }): string {
    return new Intl.DateTimeFormat('fr-MA', { ...options, timeZone: this.timeZone }).format(new Date(date + 'T12:00:00'));
  }

  chooseDate(date: string): void { this.calendarDayPicked.emit(date); }

  displayRangeLabel(): string {
    if (this.displayView() === 'day') return '07:00–20:00';
    if (this.displayView() === 'week') {
      const days = this.weekDates();
      return `${this.dateLabel(days[0] ?? this.date, { day: 'numeric', month: 'short' })} – ${this.dateLabel(days[6] ?? this.date, { day: 'numeric', month: 'short' })}`;
    }
    if (this.displayView() === 'month') return this.dateLabel(this.date, { month: 'long', year: 'numeric' });
    return this.dateLabel(this.date, { year: 'numeric' });
  }

  private dateString(date: Date): string {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
}
