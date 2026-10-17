CREATE TABLE appointments (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN (
    'SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS',
    'COMPLETED', 'CANCELLED', 'NO_SHOW'
  )),
  reason text,
  created_by_id text REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_positive_duration CHECK (ends_at > starts_at),
  FOREIGN KEY (organization_id, clinic_id)
    REFERENCES clinics(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, patient_id, clinic_id)
    REFERENCES patient_clinics(organization_id, patient_id, clinic_id) ON DELETE CASCADE
);

CREATE INDEX appointments_clinic_schedule_idx
  ON appointments(organization_id, clinic_id, starts_at, ends_at);
CREATE INDEX appointments_patient_schedule_idx
  ON appointments(organization_id, patient_id, starts_at DESC);
CREATE INDEX appointments_clinic_status_idx
  ON appointments(organization_id, clinic_id, status, starts_at);
