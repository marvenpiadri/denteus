export type DocumentCategory =
  | 'panoramic_xray'
  | 'periapical_xray'
  | 'cbct_3d'
  | 'intraoral_photo'
  | 'prescription'
  | 'consent_form'
  | 'lab_slip';

export interface DentalDocument {
  id: string;
  patientId: string;
  clinicId: string;
  title: string;
  category: DocumentCategory;
  toothNumber?: number;
  uploadedAt: string;
  uploadedBy: string;
  fileSize: string;
  fileUrl: string;
  thumbnailUrl?: string;
  notes?: string;
}
