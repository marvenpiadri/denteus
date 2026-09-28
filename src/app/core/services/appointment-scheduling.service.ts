import { Injectable } from '@angular/core';
import { Appointment } from '../models/appointment.models';

export interface AppointmentSlot {
  start: string;
  end: string;
  durationMinutes: number;
}

export interface SchedulingWindow {
  start: string;
  end: string;
}

@Injectable({ providedIn: 'root' })
export class AppointmentSchedulingService {
  getDuration(start: string, end: string): number {
    return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  }

  overlaps(
    candidateStart: string,
    candidateEnd: string,
    appointment: Appointment,
  ): boolean {
    if (appointment.status === 'cancelled' || appointment.status === 'no_show') return false;

    const start = new Date(candidateStart).getTime();
    const end = new Date(candidateEnd).getTime();
    const occupiedStart = new Date(appointment.startTime).getTime();
    const occupiedEnd = new Date(appointment.endTime).getTime();

    return start < occupiedEnd && end > occupiedStart;
  }

  isAvailable(
    appointments: Appointment[],
    start: string,
    end: string,
    doctorId: string,
    chairId: string,
  ): boolean {
    return !appointments.some(
      (appointment) =>
        appointment.doctorId === doctorId &&
        appointment.chairId === chairId &&
        this.overlaps(start, end, appointment),
    );
  }

  generateSlots(
    appointments: Appointment[],
    date: string,
    window: SchedulingWindow,
    durationMinutes: number,
    doctorId: string,
    chairId: string,
    stepMinutes = 15,
  ): AppointmentSlot[] {
    const slots: AppointmentSlot[] = [];
    let cursor = new Date(`${date}T${window.start}:00`);
    const limit = new Date(`${date}T${window.end}:00`);

    while (cursor.getTime() + durationMinutes * 60000 <= limit.getTime()) {
      const start = new Date(cursor);
      const end = new Date(cursor.getTime() + durationMinutes * 60000);
      const startIso = this.toLocalIso(start);
      const endIso = this.toLocalIso(end);

      if (this.isAvailable(appointments, startIso, endIso, doctorId, chairId)) {
        slots.push({ start: startIso, end: endIso, durationMinutes });
      }

      cursor = new Date(cursor.getTime() + stepMinutes * 60000);
    }

    return slots;
  }

  private toLocalIso(value: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
}
