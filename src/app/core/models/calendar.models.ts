import { Appointment } from './appointment.models';

export type CalendarView = 'day' | 'week' | 'month';
export type CalendarResourceMode = 'doctors' | 'chairs';

export interface CalendarResource {
  id: string;
  name: string;
  subtitle?: string;
  color: string;
}

export interface CalendarEventStyle {
  top: number;
  height: number;
}

export interface CalendarDay {
  date: string;
  label: string;
  weekday: string;
  dayNumber: number;
  isToday: boolean;
  inCurrentMonth: boolean;
  appointments: Appointment[];
}
