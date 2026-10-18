CREATE TABLE odontogram_revisions (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  odontogram_id text NOT NULL REFERENCES odontogram_records(id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  snapshot jsonb NOT NULL,
  recorded_by_id text REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (odontogram_id, version_no),
  FOREIGN KEY (organization_id, patient_id, clinic_id)
    REFERENCES patient_clinics(organization_id, patient_id, clinic_id) ON DELETE CASCADE
);

CREATE INDEX odontogram_revisions_patient_history_idx
  ON odontogram_revisions(organization_id, clinic_id, patient_id, created_at DESC);
