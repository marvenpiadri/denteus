export type ProcedureCategory =
  | 'consultation'
  | 'prevention'
  | 'soins_conservateurs'
  | 'endodontie'
  | 'prothese'
  | 'chirurgie'
  | 'parodontologie'
  | 'implantologie'
  | 'esthetique'
  | 'orthodontie';

export interface DentalProcedure {
  id: string;
  code: string;
  name: string;
  category: ProcedureCategory;
  defaultFee: number;
  durationMinutes: number;
  requiresTooth: boolean;
  description?: string;
  isActive: boolean;
}

export type TreatmentPlanStatus =
  | 'planned'
  | 'presented'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'declined';

export interface TreatmentPlanItem {
  id: string;
  planId: string;
  toothNumber?: number;
  surfaces?: string[];
  procedureCode: string;
  procedureName: string;
  category: ProcedureCategory;
  fee: number;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

export interface TreatmentPlan {
  id: string;
  patientId: string;
  clinicId: string;
  doctorId: string;
  doctorName: string;
  title: string;
  createdAt: string;
  status: TreatmentPlanStatus;
  items: TreatmentPlanItem[];
  subtotal: number;
  discountPercent: number;
  total: number;
  notes?: string;
}
