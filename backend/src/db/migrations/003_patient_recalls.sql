CREATE TABLE patient_recalls (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  recall_type text NOT NULL CHECK (length(trim(recall_type)) BETWEEN 1 AND 100),
  due_on date NOT NULL,
  previous_completed_on date,
  interval_months integer NOT NULL DEFAULT 6 CHECK (interval_months BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'DUE' CHECK (status IN ('DUE', 'CONTACTED', 'SCHEDULED', 'COMPLETED', 'DECLINED', 'INACTIVE')),
  preferred_contact_method text CHECK (preferred_contact_method IN ('PHONE', 'SMS', 'EMAIL', 'WHATSAPP', 'IN_PERSON', 'UNKNOWN')),
  last_contacted_at timestamptz,
  note text,
  created_by_id text REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, clinic_id, id),
  FOREIGN KEY (organization_id, clinic_id)
    REFERENCES clinics(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, patient_id, clinic_id)
    REFERENCES patient_clinics(organization_id, patient_id, clinic_id) ON DELETE CASCADE
);

CREATE INDEX patient_recalls_clinic_due_idx
  ON patient_recalls(organization_id, clinic_id, due_on, status);
CREATE INDEX patient_recalls_patient_idx
  ON patient_recalls(organization_id, clinic_id, patient_id, due_on DESC);

CREATE TABLE patient_recall_events (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  recall_id text NOT NULL,
  user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('CREATED', 'CONTACT_ATTEMPT', 'STATUS_CHANGED', 'NOTE_ADDED')),
  from_status text,
  to_status text,
  contact_method text CHECK (contact_method IN ('PHONE', 'SMS', 'EMAIL', 'WHATSAPP', 'IN_PERSON', 'UNKNOWN')),
  outcome text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, clinic_id)
    REFERENCES clinics(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, clinic_id, recall_id)
    REFERENCES patient_recalls(organization_id, clinic_id, id) ON DELETE CASCADE
);
CREATE INDEX patient_recall_events_history_idx
  ON patient_recall_events(organization_id, clinic_id, recall_id, created_at DESC);
