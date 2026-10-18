CREATE TABLE patient_clinical_history_entries (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('ALLERGY','MEDICAL_CONDITION','MEDICATION','DENTAL_HISTORY','PRECAUTION','OTHER')),
  content text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 8000),
  recorded_by_id text NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, patient_id, clinic_id)
    REFERENCES patient_clinics(organization_id, patient_id, clinic_id) ON DELETE CASCADE
);
CREATE INDEX patient_clinical_history_patient_idx
  ON patient_clinical_history_entries(organization_id, clinic_id, patient_id, created_at DESC);
