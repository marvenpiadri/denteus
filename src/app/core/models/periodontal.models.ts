export type PerioSiteKey = 'MB' | 'B' | 'DB' | 'ML' | 'L' | 'DL';

export interface PerioSiteMeasurement {
  pd: number; // Probing depth in mm (e.g. 2-10)
  gm: number; // Gingival margin recession in mm (negative = recession, positive = hyperplasia)
  cal?: number; // Clinical attachment loss = pd + gm
  bop: boolean; // Bleeding on probing
  suppuration: boolean; // Suppuration / pus
}

export interface ToothPerioMeasurement {
  toothNumber: number;
  sites: Record<PerioSiteKey, PerioSiteMeasurement>;
  mobility?: 0 | 1 | 2 | 3;
  furcation?: Record<string, 1 | 2 | 3 | 4>; // For molars: buccal, mesial, distal
  plaqueSites?: PerioSiteKey[];
  implant?: boolean;
}

export type PeriodontalDiagnosisCategory =
  | 'Sain'
  | 'Gingivite'
  | 'Parodontite Stade I'
  | 'Parodontite Stade II'
  | 'Parodontite Stade III'
  | 'Parodontite Stade IV';

export interface PeriodontalExamination {
  id: string;
  patientId: string;
  clinicId: string;
  doctorId: string;
  doctorName: string;
  examDate: string;
  measurements: Record<number, ToothPerioMeasurement>; // keyed by tooth number (e.g. 16, 21, 36)
  summary: {
    totalSitesCharted: number;
    bleedingSitesCount: number;
    bopPercentage: number;
    deepPocketsCount: number; // PD >= 5mm
    worstCal: number;
    worstCalTooth: number;
    plaqueIndexPercentage: number;
    diagnosis: PeriodontalDiagnosisCategory;
  };
  notes?: string;
  createdAt: string;
}
