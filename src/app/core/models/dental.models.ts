export type ToothNumberingSystem = 'FDI' | 'UNIVERSAL' | 'PALMER';

export type ToothSurface = 'M' | 'D' | 'O' | 'B' | 'L'; // Mesial, Distal, Occlusal, Buccal/Vestibular, Lingual/Palatal

export type ToothConditionType =
  | 'healthy'
  | 'caries'
  | 'filling'
  | 'crown'
  | 'bridge_abutment'
  | 'bridge_pontic'
  | 'missing'
  | 'implant'
  | 'endo_treated'
  | 'endo_needed'
  | 'apical_lesion'
  | 'fracture'
  | 'impacted';

export type ClinicalWorkStatus = 'diagnosed' | 'existing' | 'planned' | 'in_progress' | 'completed';

export interface ToothCondition {
  id: string;
  patientId: string;
  toothNumber: number; // FDI number (e.g. 16, 21, 36, 47)
  condition: ToothConditionType;
  surfaces: ToothSurface[];
  status: ClinicalWorkStatus;
  severity?: number; // e.g. ICDAS 1-6
  material?: string; // Composite, Amalgame, Céramique, Zircone, Titane
  diagnosedAt: string;
  resolvedAt?: string;
  notes?: string;
  createdBy: string;
}

export interface ToothHistoryRecord {
  id: string;
  toothNumber: number;
  date: string;
  action: string;
  status: ClinicalWorkStatus;
  doctorName: string;
  notes?: string;
}

export interface PatientOdontogramData {
  patientId: string;
  numberingSystem: ToothNumberingSystem;
  conditions: ToothCondition[];
  lastUpdated: string;
}
