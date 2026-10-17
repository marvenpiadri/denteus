ALTER TABLE appointments
  ADD CONSTRAINT appointments_org_clinic_id_unique UNIQUE (organization_id, clinic_id, id);

CREATE TABLE patient_treatments (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  appointment_id text,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  category text NOT NULL CHECK (category IN (
    'EXAM', 'HYGIENE', 'RESTORATIVE', 'ENDODONTICS', 'EXTRACTION',
    'PROSTHODONTICS', 'ORTHODONTICS', 'PERIODONTICS', 'IMPLANT', 'OTHER'
  )),
  status text NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'ACCEPTED', 'COMPLETED', 'DECLINED')),
  notes text,
  performed_at timestamptz,
  performed_by_id text REFERENCES app_users(id) ON DELETE SET NULL,
  recorded_by_id text REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, clinic_id, id),
  CHECK ((status = 'COMPLETED') = (performed_at IS NOT NULL)),
  FOREIGN KEY (organization_id, clinic_id)
    REFERENCES clinics(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, patient_id, clinic_id)
    REFERENCES patient_clinics(organization_id, patient_id, clinic_id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, clinic_id, appointment_id)
    REFERENCES appointments(organization_id, clinic_id, id) ON DELETE RESTRICT
);
CREATE INDEX patient_treatments_patient_history_idx
  ON patient_treatments(organization_id, clinic_id, patient_id, created_at DESC);
CREATE INDEX patient_treatments_status_idx
  ON patient_treatments(organization_id, clinic_id, status, created_at DESC);

CREATE TABLE patient_treatment_teeth (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  treatment_id text NOT NULL,
  tooth_no smallint NOT NULL CHECK (tooth_no IN (
    11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,
    31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48,
    51,52,53,54,55,61,62,63,64,65,71,72,73,74,75,81,82,83,84,85
  )),
  surface text NOT NULL DEFAULT 'WHOLE' CHECK (surface IN (
    'WHOLE', 'OCCLUSAL', 'MESIAL', 'DISTAL', 'BUCCAL', 'LINGUAL', 'PALATAL', 'CERVICAL'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (treatment_id, tooth_no, surface),
  FOREIGN KEY (organization_id, clinic_id, treatment_id)
    REFERENCES patient_treatments(organization_id, clinic_id, id) ON DELETE CASCADE
);
CREATE INDEX patient_treatment_teeth_tooth_idx
  ON patient_treatment_teeth(organization_id, clinic_id, tooth_no);

CREATE TABLE patient_treatment_events (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  treatment_id text NOT NULL,
  actor_id text REFERENCES app_users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('CREATED', 'STATUS_CHANGED')),
  from_status text CHECK (from_status IS NULL OR from_status IN ('PLANNED', 'ACCEPTED', 'COMPLETED', 'DECLINED')),
  to_status text NOT NULL CHECK (to_status IN ('PLANNED', 'ACCEPTED', 'COMPLETED', 'DECLINED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, patient_id, clinic_id)
    REFERENCES patient_clinics(organization_id, patient_id, clinic_id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, clinic_id, treatment_id)
    REFERENCES patient_treatments(organization_id, clinic_id, id) ON DELETE CASCADE
);
CREATE INDEX patient_treatment_events_history_idx
  ON patient_treatment_events(organization_id, clinic_id, treatment_id, created_at DESC);
