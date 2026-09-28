export type AppointmentStatus =
  | 'booked'
  | 'confirmed'
  | 'arrived'
  | 'in_treatment'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type AppointmentType =
  | 'consultation'
  | 'soin'
  | 'detartrage'
  | 'endodontie'
  | 'prothese'
  | 'chirurgie'
  | 'urgence'
  | 'controle';

export interface Appointment {
  id: string;
  organizationId: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientNumber: string;
  doctorId: string;
  doctorName: string;
  doctorColor: string;
  chairId: string;
  chairName: string;
  appointmentType: AppointmentType;
  startTime: string; // ISO string e.g. "2026-09-28T09:00:00"
  endTime: string; // ISO string e.g. "2026-09-28T09:45:00"
  durationMinutes: number;
  status: AppointmentStatus;
  arrivedAt?: string;
  inTreatmentAt?: string;
  completedAt?: string;
  reason: string;
  notes?: string;
}
