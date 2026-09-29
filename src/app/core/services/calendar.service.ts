import { Injectable } from '@angular/core';
import { Appointment } from '../models/appointment.models';
import { CalendarDay, CalendarEventStyle } from '../models/calendar.models';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  readonly dayStartHour = 7;
  readonly dayEndHour = 20;
  readonly slotMinutes = 30;

  formatDateKey(value: Date): string {
    return this.localIso(value).slice(0, 10);
  }

  parseLocalDate(value: string): Date {
    const [date, time = '00:00'] = value.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  }

  addDays(value: Date, days: number): Date {
    const result = new Date(value);
    result.setDate(result.getDate() + days);
    return result;
  }

  startOfWeek(value: Date): Date {
    const result = new Date(value);
    result.setHours(0, 0, 0, 0);
    const day = result.getDay();
    result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
    return result;
  }

  startOfMonth(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), 1);
  }

  isToday(value: Date): boolean {
    const now = new Date();
    return value.getFullYear() === now.getFullYear() &&
      value.getMonth() === now.getMonth() &&
      value.getDate() === now.getDate();
  }

  minutesFromDayStart(iso: string): number {
    const value = this.parseLocalDate(iso);
    return (value.getHours() - this.dayStartHour) * 60 + value.getMinutes();
  }

  eventStyle(appointment: Appointment): CalendarEventStyle {
    const top = Math.max(0, this.minutesFromDayStart(appointment.startTime));
    const duration = Math.max(20, Math.round(
      (this.parseLocalDate(appointment.endTime).getTime() - this.parseLocalDate(appointment.startTime).getTime()) / 60000,
    ));
    return {
      top: (top / this.slotMinutes) * 52,
      height: Math.max(36, (duration / this.slotMinutes) * 52 - 4),
    };
  }

  timeLabel(minutes: number): string {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  getWeekDays(anchor: Date): Date[] {
    const start = this.startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, index) => this.addDays(start, index));
  }

  getMonthDays(anchor: Date): CalendarDay[] {
    const first = this.startOfMonth(anchor);
    const gridStart = this.startOfWeek(first);
    const gridEnd = this.addDays(gridStart, 41);
    const days: CalendarDay[] = [];
    for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = this.addDays(cursor, 1)) {
      const date = new Date(cursor);
      days.push({
        date: this.formatDateKey(date),
        label: new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(date),
        weekday: new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(date),
        dayNumber: date.getDate(),
        isToday: this.isToday(date),
        inCurrentMonth: date.getMonth() === anchor.getMonth(),
        appointments: [],
      });
    }
    return days;
  }

  toDateLabel(value: Date, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('fr-FR', options).format(value);
  }

  localIso(value: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:00`;
  }
  readonly defaultEventPalette = ['#0d9488','#2563eb','#7c3aed','#db2777','#ea580c','#ca8a04','#475569','#0891b2'];

  snapMinutes(value: number, snap = this.slotMinutes): number {
    return Math.round(value / snap) * snap;
  }

  clampToWorkingHours(value: number): number {
    const min = 0;
    const max = (this.dayEndHour - this.dayStartHour) * 60;
    return Math.min(max, Math.max(min, value));
  }

  eventDurationMinutes(start: string, end: string): number {
    return Math.max(1, Math.round((this.parseLocalDate(end).getTime() - this.parseLocalDate(start).getTime()) / 60000));
  }

  colorWithAlpha(hex: string, alpha = 0.12): string {
    const value = hex.replace('#', '');
    if (value.length !== 6) return hex;
    const r = Number.parseInt(value.slice(0, 2), 16);
    const g = Number.parseInt(value.slice(2, 4), 16);
    const b = Number.parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
