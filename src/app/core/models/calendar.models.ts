export type CalendarView = 'day' | 'week' | 'work-week' | 'month' | 'agenda' | 'timeline';
export type CalendarResourceMode = 'doctors' | 'chairs';
export type CalendarSnapMinutes = 5 | 10 | 15 | 30 | 60;

export interface CalendarResource {
  id: string;
  name: string;
  subtitle?: string;
  color?: string;
  groupId?: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resourceIds?: string[];
  color?: string;
  textColor?: string;
  status?: string;
  category?: string;
  recurrence?: CalendarRecurrence;
  metadata?: Record<string, unknown>;
}

export interface CalendarRecurrence {
  rule: string;
  timezone?: string;
  until?: Date;
  count?: number;
  exceptions?: Date[];
}

export interface CalendarEventStyle {
  top: number;
  height: number;
  left?: number;
  width?: number;
  column?: number;
  columns?: number;
}

export interface CalendarDay {
  date: string;
  label: string;
  weekday: string;
  dayNumber: number;
  isToday: boolean;
  inCurrentMonth: boolean;
  appointments: import('./appointment.models').Appointment[];
}

export interface CalendarInteractionOptions {
  snapMinutes: CalendarSnapMinutes;
  allowOverlap: boolean;
  allowDrag: boolean;
  allowResize: boolean;
  allowCreate: boolean;
}

export interface CalendarTheme {
  accent: string;
  eventPalette: string[];
  surface?: string;
  border?: string;
}
