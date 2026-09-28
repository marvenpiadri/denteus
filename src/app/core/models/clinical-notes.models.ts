export interface ClinicalNote {
  id: string;
  patientId: string;
  clinicId: string;
  authorId: string;
  authorName: string;
  date: string;
  toothNumber?: number;
  appointmentId?: string;
  category: 'consultation' | 'soin' | 'chirurgie' | 'controle' | 'urgence';
  subjective?: string; // Motif de consultation, anamnèse
  objective?: string;  // Examen clinique, radios
  assessment?: string; // Diagnostic
  plan?: string;       // Traitement réalisé et suites à donner
  rawContent?: string;
  isLocked: boolean;   // Finalized medico-legal status
  lockedAt?: string;
  lockedBy?: string;
}
