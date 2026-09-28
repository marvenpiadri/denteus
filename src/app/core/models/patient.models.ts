export interface MedicalAlertInfo {
  allergies: string[];
  medicalConditions: string[];
  medications: string[];
  notes?: string;
  bloodGroup?: string;
  hasHighRisk: boolean;
}

export interface PatientRecall {
  id: string;
  patientId: string;
  dueDate: string;
  type: 'cleaning' | 'checkup' | 'periodontal_maintenance' | 'ortho_adjustment';
  status: 'pending' | 'scheduled' | 'overdue' | 'completed';
  notes?: string;
}

export interface ClinicalTimelineEvent {
  id: string;
  patientId: string;
  date: string;
  type: 'consultation' | 'caries' | 'endo' | 'crown' | 'periodontal' | 'treatment_plan' | 'invoice' | 'payment';
  title: string;
  description: string;
  doctorName: string;
  toothNumber?: number;
}

export interface Patient {
  id: string;
  organizationId: string;
  clinicIds: string[];
  patientNumber: string; // e.g. "DEN-2026-0042"
  firstName: string;
  lastName: string;
  cin: string; // Carte d'identité nationale
  birthDate: string;
  gender: 'M' | 'F';
  phone: string;
  email: string;
  address: string;
  city: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  medicalAlert: MedicalAlertInfo;
  balanceDue: number; // In local currency (MAD)
  nextRecall?: PatientRecall;
  createdAt: string;
  updatedAt: string;
}
