-- Denteus initial PostgreSQL schema.
-- This is the canonical schema for a new, empty database; no legacy upgrade path.

CREATE TABLE app_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions(expires_at);

CREATE TABLE auth_accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  account_id text NOT NULL,
  password_hash text,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_accounts_provider_account_unique UNIQUE (provider_id, account_id)
);
CREATE INDEX auth_accounts_user_id_idx ON auth_accounts(user_id);

CREATE TABLE auth_verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_verifications_identifier_idx ON auth_verifications(identifier);

CREATE TABLE organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  currency char(3) NOT NULL DEFAULT 'MAD',
  locale text NOT NULL DEFAULT 'fr',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9]+([a-z0-9-]*[a-z0-9])?$')
);

CREATE TABLE organization_memberships (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN (
    'ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN', 'CLINIC_ADMIN',
    'DENTIST', 'ORTHODONTIST', 'HYGIENIST', 'ASSISTANT',
    'RECEPTIONIST', 'ACCOUNTANT'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX organization_memberships_user_role_idx ON organization_memberships(user_id, role);

CREATE TABLE patient_number_counters (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number_year integer NOT NULL,
  last_value bigint NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  PRIMARY KEY (organization_id, number_year)
);

CREATE TABLE clinics (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  address text,
  phone text,
  email text,
  timezone text NOT NULL DEFAULT 'Africa/Casablanca',
  opening_hours jsonb,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);
CREATE INDEX clinics_organization_status_idx ON clinics(organization_id, status);
CREATE INDEX clinics_city_idx ON clinics(city);

CREATE TABLE clinic_memberships (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN (
    'ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN', 'CLINIC_ADMIN',
    'DENTIST', 'ORTHODONTIST', 'HYGIENIST', 'ASSISTANT',
    'RECEPTIONIST', 'ACCOUNTANT'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, user_id),
  FOREIGN KEY (organization_id, clinic_id)
    REFERENCES clinics(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, user_id)
    REFERENCES organization_memberships(organization_id, user_id) ON DELETE CASCADE
);
CREATE INDEX clinic_memberships_user_idx ON clinic_memberships(user_id);
CREATE INDEX clinic_memberships_org_clinic_idx ON clinic_memberships(organization_id, clinic_id);

CREATE TABLE patients (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_number text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_date date,
  gender text,
  national_id text,
  phone text,
  email text,
  address text,
  city text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, patient_number),
  UNIQUE (organization_id, id)
);
CREATE INDEX patients_org_name_idx ON patients(organization_id, last_name, first_name);
CREATE INDEX patients_org_phone_idx ON patients(organization_id, phone);
CREATE INDEX patients_org_email_idx ON patients(organization_id, email);

CREATE TABLE patient_clinics (
  organization_id text NOT NULL,
  patient_id text NOT NULL,
  clinic_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (patient_id, clinic_id),
  UNIQUE (organization_id, patient_id, clinic_id),
  FOREIGN KEY (organization_id, patient_id)
    REFERENCES patients(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, clinic_id)
    REFERENCES clinics(organization_id, id) ON DELETE CASCADE
);
CREATE INDEX patient_clinics_clinic_idx ON patient_clinics(clinic_id);

CREATE TABLE odontogram_records (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  status_payload jsonb NOT NULL,
  plan_payload jsonb,
  plan_changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  extra_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by_id text REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, clinic_id),
  FOREIGN KEY (organization_id, clinic_id)
    REFERENCES clinics(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, patient_id)
    REFERENCES patients(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, patient_id, clinic_id)
    REFERENCES patient_clinics(organization_id, patient_id, clinic_id) ON DELETE CASCADE
);
CREATE INDEX odontogram_records_org_clinic_idx ON odontogram_records(organization_id, clinic_id);

CREATE TABLE audit_events (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_org_created_idx ON audit_events(organization_id, created_at DESC);
CREATE INDEX audit_events_user_created_idx ON audit_events(user_id, created_at DESC);

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

CREATE TABLE clinic_providers (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 160),
  role text NOT NULL CHECK (role IN ('DENTIST', 'ORTHODONTIST', 'HYGIENIST', 'ASSISTANT', 'SPECIALIST')),
  color text NOT NULL DEFAULT '#087f75' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, clinic_id, id),
  FOREIGN KEY (organization_id, clinic_id)
    REFERENCES clinics(organization_id, id) ON DELETE CASCADE
);
CREATE INDEX clinic_providers_active_idx
  ON clinic_providers(organization_id, clinic_id, active, display_name);

CREATE TABLE clinic_operatories (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  chair_number integer CHECK (chair_number IS NULL OR chair_number BETWEEN 1 AND 999),
  color text NOT NULL DEFAULT '#267d93' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, clinic_id, id),
  UNIQUE (organization_id, clinic_id, name),
  FOREIGN KEY (organization_id, clinic_id)
    REFERENCES clinics(organization_id, id) ON DELETE CASCADE
);
CREATE INDEX clinic_operatories_active_idx
  ON clinic_operatories(organization_id, clinic_id, active, name);

CREATE TABLE provider_working_hours (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  provider_id text NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  UNIQUE (organization_id, clinic_id, provider_id, day_of_week),
  FOREIGN KEY (organization_id, clinic_id, provider_id)
    REFERENCES clinic_providers(organization_id, clinic_id, id) ON DELETE CASCADE
);

ALTER TABLE appointments
  ADD COLUMN provider_id text,
  ADD COLUMN operatory_id text,
  ADD CONSTRAINT appointments_provider_fk
    FOREIGN KEY (organization_id, clinic_id, provider_id)
    REFERENCES clinic_providers(organization_id, clinic_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT appointments_operatory_fk
    FOREIGN KEY (organization_id, clinic_id, operatory_id)
    REFERENCES clinic_operatories(organization_id, clinic_id, id) ON DELETE RESTRICT;

CREATE INDEX appointments_provider_schedule_idx
  ON appointments(organization_id, clinic_id, provider_id, starts_at, ends_at)
  WHERE provider_id IS NOT NULL AND status NOT IN ('CANCELLED', 'NO_SHOW');
CREATE INDEX appointments_operatory_schedule_idx
  ON appointments(organization_id, clinic_id, operatory_id, starts_at, ends_at)
  WHERE operatory_id IS NOT NULL AND status NOT IN ('CANCELLED', 'NO_SHOW');

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
  UNIQUE (organization_id, clinic_id, patient_id, id),
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
    'WHOLE', 'OCCLUSAL', 'INCISAL', 'MESIAL', 'DISTAL', 'BUCCAL', 'LINGUAL', 'PALATAL', 'CERVICAL'
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
  FOREIGN KEY (organization_id, clinic_id, patient_id, treatment_id)
    REFERENCES patient_treatments(organization_id, clinic_id, patient_id, id) ON DELETE CASCADE
);
CREATE INDEX patient_treatment_events_history_idx
  ON patient_treatment_events(organization_id, clinic_id, treatment_id, created_at DESC);

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

-- Encounter-centered clinical history. Odontograms remain the current-state view.
ALTER TABLE appointments ADD CONSTRAINT appointments_org_clinic_patient_id_unique UNIQUE (organization_id, clinic_id, patient_id, id);

CREATE TABLE clinical_encounters (
 id text PRIMARY KEY, organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, appointment_id text,
 status text NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('DRAFT','IN_PROGRESS','SIGNED','CANCELLED')),
 encounter_type text NOT NULL DEFAULT 'CONSULTATION' CHECK (encounter_type IN ('CONSULTATION','EMERGENCY','FOLLOW_UP','PROCEDURE','OTHER')),
 responsible_provider_id text,
 started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz, chief_complaint text,
 created_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, updated_by_id text REFERENCES app_users(id) ON DELETE RESTRICT,
 signed_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, signed_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id, clinic_id, patient_id, id),
 CHECK (ended_at IS NULL OR ended_at >= started_at),
 CHECK ((status = 'SIGNED') = (signed_at IS NOT NULL)),
 CHECK ((status = 'SIGNED') = (signed_by_id IS NOT NULL)),
 FOREIGN KEY (organization_id, clinic_id) REFERENCES clinics(organization_id, id) ON DELETE CASCADE,
 FOREIGN KEY (organization_id, clinic_id, responsible_provider_id) REFERENCES clinic_providers(organization_id, clinic_id, id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id, patient_id, clinic_id) REFERENCES patient_clinics(organization_id, patient_id, clinic_id) ON DELETE CASCADE,
 FOREIGN KEY (organization_id, clinic_id, patient_id, appointment_id) REFERENCES appointments(organization_id, clinic_id, patient_id, id) ON DELETE RESTRICT
);
CREATE INDEX clinical_encounters_patient_timeline_idx ON clinical_encounters(organization_id, clinic_id, patient_id, started_at DESC, created_at DESC);
CREATE INDEX clinical_encounters_provider_timeline_idx ON clinical_encounters(organization_id, clinic_id, responsible_provider_id, started_at DESC);
CREATE INDEX clinical_encounters_status_idx ON clinical_encounters(organization_id, clinic_id, status, started_at DESC);

CREATE TABLE clinical_encounter_participants (
 organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, encounter_id text NOT NULL,
 user_id text NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK (role IN ('TREATING_DENTIST','ASSISTANT','OBSERVER','HYGIENIST','OTHER')),
 added_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (encounter_id, user_id),
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id) REFERENCES clinical_encounters(organization_id, clinic_id, patient_id, id) ON DELETE CASCADE
);
CREATE INDEX clinical_encounter_participants_user_idx ON clinical_encounter_participants(organization_id, clinic_id, user_id, created_at DESC);

CREATE TABLE clinical_notes (
 id text PRIMARY KEY, organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, encounter_id text NOT NULL,
 note_type text NOT NULL DEFAULT 'PROGRESS' CHECK (note_type IN ('CHIEF_COMPLAINT','EXAMINATION','ASSESSMENT','PROGRESS','DISCHARGE','OTHER')),
 content text NOT NULL CHECK (length(trim(content)) > 0),
 created_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, updated_by_id text REFERENCES app_users(id) ON DELETE RESTRICT,
 signed_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, signed_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id, clinic_id, patient_id, encounter_id, id), CHECK ((signed_at IS NULL) = (signed_by_id IS NULL)),
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id) REFERENCES clinical_encounters(organization_id, clinic_id, patient_id, id) ON DELETE CASCADE
);
CREATE INDEX clinical_notes_encounter_idx ON clinical_notes(organization_id, clinic_id, encounter_id, created_at);

CREATE TABLE clinical_note_amendments (
 id text PRIMARY KEY, organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, encounter_id text NOT NULL, note_id text NOT NULL,
 reason text NOT NULL CHECK (length(trim(reason)) > 0), amended_content text NOT NULL CHECK (length(trim(amended_content)) > 0),
 amended_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id, note_id) REFERENCES clinical_notes(organization_id, clinic_id, patient_id, encounter_id, id) ON DELETE RESTRICT
);
CREATE INDEX clinical_note_amendments_note_idx ON clinical_note_amendments(organization_id, clinic_id, note_id, created_at);
CREATE FUNCTION prevent_clinical_note_amendment_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Clinical note amendments are append-only' USING ERRCODE = '55000'; END;
$$;
CREATE TRIGGER clinical_note_amendments_immutable BEFORE UPDATE OR DELETE ON clinical_note_amendments FOR EACH ROW EXECUTE FUNCTION prevent_clinical_note_amendment_mutation();
CREATE FUNCTION protect_signed_clinical_note() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.signed_at IS NOT NULL AND (NEW.content IS DISTINCT FROM OLD.content OR NEW.note_type IS DISTINCT FROM OLD.note_type OR NEW.signed_at IS DISTINCT FROM OLD.signed_at OR NEW.signed_by_id IS DISTINCT FROM OLD.signed_by_id) THEN
  RAISE EXCEPTION 'Signed clinical notes cannot be changed; create an amendment' USING ERRCODE = '55000';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER clinical_notes_signed_immutable BEFORE UPDATE ON clinical_notes FOR EACH ROW EXECUTE FUNCTION protect_signed_clinical_note();

CREATE TABLE clinical_findings (
 id text PRIMARY KEY, organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, encounter_id text NOT NULL,
 finding_code text, finding_type text NOT NULL CHECK (finding_type IN ('OBSERVATION','DIAGNOSIS','SYMPTOM','RISK','OTHER')),
 description text NOT NULL CHECK (length(trim(description)) > 0), severity text CHECK (severity IN ('LOW','MODERATE','HIGH','CRITICAL')),
 tooth_no smallint CHECK (tooth_no IN (11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48,51,52,53,54,55,61,62,63,64,65,71,72,73,74,75,81,82,83,84,85)),
 surface text CHECK (surface IN ('WHOLE','OCCLUSAL','INCISAL','MESIAL','DISTAL','BUCCAL','LINGUAL','PALATAL','CERVICAL')),
 recorded_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (surface IS NULL OR tooth_no IS NOT NULL),
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id) REFERENCES clinical_encounters(organization_id, clinic_id, patient_id, id) ON DELETE CASCADE
);
CREATE INDEX clinical_findings_encounter_idx ON clinical_findings(organization_id, clinic_id, encounter_id, created_at);
CREATE INDEX clinical_findings_tooth_idx ON clinical_findings(organization_id, clinic_id, patient_id, tooth_no, created_at DESC);

CREATE TABLE clinical_procedures (
 id text PRIMARY KEY, organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, encounter_id text NOT NULL,
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
 category text NOT NULL CHECK (category IN ('EXAM','HYGIENE','RESTORATIVE','ENDODONTICS','EXTRACTION','PROSTHODONTICS','ORTHODONTICS','PERIODONTICS','IMPLANT','OTHER')),
 status text NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')), notes text, performed_at timestamptz,
 performed_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, recorded_by_id text REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id, clinic_id, patient_id, encounter_id, id),
 CHECK ((status = 'COMPLETED') = (performed_at IS NOT NULL)), CHECK ((status = 'COMPLETED') = (performed_by_id IS NOT NULL)),
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id) REFERENCES clinical_encounters(organization_id, clinic_id, patient_id, id) ON DELETE CASCADE
);
CREATE INDEX clinical_procedures_encounter_idx ON clinical_procedures(organization_id, clinic_id, encounter_id, created_at);
CREATE INDEX clinical_procedures_patient_history_idx ON clinical_procedures(organization_id, clinic_id, patient_id, performed_at DESC);

CREATE TABLE clinical_procedure_sites (
 organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, encounter_id text NOT NULL, procedure_id text NOT NULL,
 tooth_no smallint NOT NULL CHECK (tooth_no IN (11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48,51,52,53,54,55,61,62,63,64,65,71,72,73,74,75,81,82,83,84,85)),
 surface text NOT NULL DEFAULT 'WHOLE' CHECK (surface IN ('WHOLE','OCCLUSAL','INCISAL','MESIAL','DISTAL','BUCCAL','LINGUAL','PALATAL','CERVICAL')),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (procedure_id, tooth_no, surface),
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id, procedure_id) REFERENCES clinical_procedures(organization_id, clinic_id, patient_id, encounter_id, id) ON DELETE CASCADE
);
CREATE INDEX clinical_procedure_sites_tooth_idx ON clinical_procedure_sites(organization_id, clinic_id, patient_id, tooth_no, created_at DESC);

CREATE TABLE treatment_plans (
 id text PRIMARY KEY, organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, origin_encounter_id text,
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
 status text NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('DRAFT','PROPOSED','ACCEPTED','IN_PROGRESS','COMPLETED','DECLINED','CANCELLED')),
 notes text, created_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, updated_by_id text REFERENCES app_users(id) ON DELETE RESTRICT,
 accepted_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id, clinic_id, patient_id, id), CHECK ((accepted_at IS NULL) = (accepted_by_id IS NULL)),
 FOREIGN KEY (organization_id, clinic_id) REFERENCES clinics(organization_id, id) ON DELETE CASCADE,
 FOREIGN KEY (organization_id, patient_id, clinic_id) REFERENCES patient_clinics(organization_id, patient_id, clinic_id) ON DELETE CASCADE,
 FOREIGN KEY (organization_id, clinic_id, patient_id, origin_encounter_id) REFERENCES clinical_encounters(organization_id, clinic_id, patient_id, id) ON DELETE RESTRICT
);
CREATE INDEX treatment_plans_patient_idx ON treatment_plans(organization_id, clinic_id, patient_id, updated_at DESC);

CREATE TABLE treatment_plan_items (
 id text PRIMARY KEY, organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, plan_id text NOT NULL,
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
 category text NOT NULL CHECK (category IN ('EXAM','HYGIENE','RESTORATIVE','ENDODONTICS','EXTRACTION','PROSTHODONTICS','ORTHODONTICS','PERIODONTICS','IMPLANT','OTHER')),
 status text NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','ACCEPTED','IN_PROGRESS','COMPLETED','DECLINED','CANCELLED')),
 sequence_no integer NOT NULL DEFAULT 1 CHECK (sequence_no > 0), notes text,
 created_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, updated_by_id text REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (plan_id, sequence_no), UNIQUE (organization_id, clinic_id, patient_id, plan_id, id),
 FOREIGN KEY (organization_id, clinic_id, patient_id, plan_id) REFERENCES treatment_plans(organization_id, clinic_id, patient_id, id) ON DELETE CASCADE
);
CREATE INDEX treatment_plan_items_plan_idx ON treatment_plan_items(organization_id, clinic_id, plan_id, sequence_no);
CREATE TABLE treatment_plan_item_sites (
 organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, plan_id text NOT NULL, item_id text NOT NULL,
 tooth_no smallint NOT NULL CHECK (tooth_no IN (11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48,51,52,53,54,55,61,62,63,64,65,71,72,73,74,75,81,82,83,84,85)),
 surface text NOT NULL DEFAULT 'WHOLE' CHECK (surface IN ('WHOLE','OCCLUSAL','INCISAL','MESIAL','DISTAL','BUCCAL','LINGUAL','PALATAL','CERVICAL')),
 PRIMARY KEY (item_id, tooth_no, surface),
 FOREIGN KEY (organization_id, clinic_id, patient_id, plan_id, item_id) REFERENCES treatment_plan_items(organization_id, clinic_id, patient_id, plan_id, id) ON DELETE CASCADE
);

CREATE TABLE clinical_media (
 id text PRIMARY KEY, organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, encounter_id text NOT NULL,
 media_type text NOT NULL CHECK (media_type IN ('INTRAORAL_XRAY','PANORAMIC_XRAY','CBCT','INTRAORAL_PHOTO','EXTRAORAL_PHOTO','SCAN','DOCUMENT','OTHER')),
 storage_key text CHECK (storage_key IS NULL OR length(trim(storage_key)) > 0), original_filename text, mime_type text NOT NULL,
 size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 8388608), checksum_sha256 char(64), content_bytes bytea, captured_at timestamptz, description text,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb, uploaded_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id, clinic_id, storage_key), UNIQUE (organization_id, clinic_id, patient_id, encounter_id, id),
 CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id) REFERENCES clinical_encounters(organization_id, clinic_id, patient_id, id) ON DELETE CASCADE
);
CREATE INDEX clinical_media_encounter_idx ON clinical_media(organization_id, clinic_id, encounter_id, created_at DESC);
CREATE INDEX clinical_media_patient_type_idx ON clinical_media(organization_id, clinic_id, patient_id, media_type, captured_at DESC);
CREATE TABLE clinical_media_sites (
 organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, encounter_id text NOT NULL, media_id text NOT NULL,
 tooth_no smallint NOT NULL CHECK (tooth_no IN (11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48,51,52,53,54,55,61,62,63,64,65,71,72,73,74,75,81,82,83,84,85)),
 surface text NOT NULL DEFAULT 'WHOLE' CHECK (surface IN ('WHOLE','OCCLUSAL','INCISAL','MESIAL','DISTAL','BUCCAL','LINGUAL','PALATAL','CERVICAL')),
 PRIMARY KEY (media_id, tooth_no, surface),
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id, media_id) REFERENCES clinical_media(organization_id, clinic_id, patient_id, encounter_id, id) ON DELETE CASCADE
);

CREATE TABLE clinical_follow_ups (
 id text PRIMARY KEY, organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, encounter_id text NOT NULL,
 due_at timestamptz, instruction text NOT NULL CHECK (length(trim(instruction)) > 0),
 status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','SCHEDULED','COMPLETED','CANCELLED')),
 created_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, completed_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL)), CHECK ((status = 'COMPLETED') = (completed_by_id IS NOT NULL)),
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id) REFERENCES clinical_encounters(organization_id, clinic_id, patient_id, id) ON DELETE CASCADE
);
CREATE INDEX clinical_follow_ups_due_idx ON clinical_follow_ups(organization_id, clinic_id, status, due_at);
),
 CHECK (content_bytes IS NULL OR (octet_length(content_bytes) = size_bytes AND checksum_sha256 IS NOT NULL)),
 CHECK (content_bytes IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id) REFERENCES clinical_encounters(organization_id, clinic_id, patient_id, id) ON DELETE CASCADE
);
CREATE INDEX clinical_media_encounter_idx ON clinical_media(organization_id, clinic_id, encounter_id, created_at DESC);
CREATE INDEX clinical_media_patient_type_idx ON clinical_media(organization_id, clinic_id, patient_id, media_type, captured_at DESC);
CREATE TABLE clinical_media_sites (
 organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, encounter_id text NOT NULL, media_id text NOT NULL,
 tooth_no smallint NOT NULL CHECK (tooth_no IN (11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48,51,52,53,54,55,61,62,63,64,65,71,72,73,74,75,81,82,83,84,85)),
 surface text NOT NULL DEFAULT 'WHOLE' CHECK (surface IN ('WHOLE','OCCLUSAL','INCISAL','MESIAL','DISTAL','BUCCAL','LINGUAL','PALATAL','CERVICAL')),
 PRIMARY KEY (media_id, tooth_no, surface),
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id, media_id) REFERENCES clinical_media(organization_id, clinic_id, patient_id, encounter_id, id) ON DELETE CASCADE
);

CREATE TABLE clinical_follow_ups (
 id text PRIMARY KEY, organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, encounter_id text NOT NULL,
 due_at timestamptz, instruction text NOT NULL CHECK (length(trim(instruction)) > 0),
 status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','SCHEDULED','COMPLETED','CANCELLED')),
 created_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, completed_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL)), CHECK ((status = 'COMPLETED') = (completed_by_id IS NOT NULL)),
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id) REFERENCES clinical_encounters(organization_id, clinic_id, patient_id, id) ON DELETE CASCADE
);
CREATE INDEX clinical_follow_ups_due_idx ON clinical_follow_ups(organization_id, clinic_id, status, due_at);
),
 CHECK (content_bytes IS NOT NULL OR storage_key IS NOT NULL),
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id) REFERENCES clinical_encounters(organization_id, clinic_id, patient_id, id) ON DELETE CASCADE
);
CREATE INDEX clinical_media_encounter_idx ON clinical_media(organization_id, clinic_id, encounter_id, created_at DESC);
CREATE INDEX clinical_media_patient_type_idx ON clinical_media(organization_id, clinic_id, patient_id, media_type, captured_at DESC);
CREATE TABLE clinical_media_sites (
 organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, encounter_id text NOT NULL, media_id text NOT NULL,
 tooth_no smallint NOT NULL CHECK (tooth_no IN (11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48,51,52,53,54,55,61,62,63,64,65,71,72,73,74,75,81,82,83,84,85)),
 surface text NOT NULL DEFAULT 'WHOLE' CHECK (surface IN ('WHOLE','OCCLUSAL','INCISAL','MESIAL','DISTAL','BUCCAL','LINGUAL','PALATAL','CERVICAL')),
 PRIMARY KEY (media_id, tooth_no, surface),
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id, media_id) REFERENCES clinical_media(organization_id, clinic_id, patient_id, encounter_id, id) ON DELETE CASCADE
);

CREATE TABLE clinical_follow_ups (
 id text PRIMARY KEY, organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, encounter_id text NOT NULL,
 due_at timestamptz, instruction text NOT NULL CHECK (length(trim(instruction)) > 0),
 status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','SCHEDULED','COMPLETED','CANCELLED')),
 created_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, completed_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL)), CHECK ((status = 'COMPLETED') = (completed_by_id IS NOT NULL)),
 FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id) REFERENCES clinical_encounters(organization_id, clinic_id, patient_id, id) ON DELETE CASCADE
);
CREATE INDEX clinical_follow_ups_due_idx ON clinical_follow_ups(organization_id, clinic_id, status, due_at);

-- Clinical records are corrected by append-only amendments, never silent overwrites.
CREATE OR REPLACE FUNCTION protect_signed_clinical_note()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.signed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Signed clinical notes cannot be deleted; create an amendment'
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.signed_at IS NOT NULL AND (
    NEW.content IS DISTINCT FROM OLD.content OR
    NEW.note_type IS DISTINCT FROM OLD.note_type OR
    NEW.signed_at IS DISTINCT FROM OLD.signed_at OR
    NEW.signed_by_id IS DISTINCT FROM OLD.signed_by_id
  ) THEN
    RAISE EXCEPTION 'Signed clinical notes cannot be changed; create an amendment'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER clinical_notes_signed_immutable ON clinical_notes;
CREATE TRIGGER clinical_notes_signed_immutable
  BEFORE UPDATE OR DELETE ON clinical_notes
  FOR EACH ROW EXECUTE FUNCTION protect_signed_clinical_note();

CREATE FUNCTION prevent_clinical_encounter_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Clinical encounters are retained; cancel the encounter instead of deleting it'
    USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER clinical_encounters_retained
  BEFORE DELETE ON clinical_encounters
  FOR EACH ROW EXECUTE FUNCTION prevent_clinical_encounter_delete();

ALTER TABLE clinical_findings
  ADD CONSTRAINT clinical_findings_scope_id_unique UNIQUE (organization_id, clinic_id, patient_id, encounter_id, id);

CREATE FUNCTION prevent_clinical_finding_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Clinical findings are immutable; record a correction as an amendment'
    USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER clinical_findings_immutable
  BEFORE UPDATE OR DELETE ON clinical_findings
  FOR EACH ROW EXECUTE FUNCTION prevent_clinical_finding_mutation();

CREATE TABLE clinical_finding_amendments (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  encounter_id text NOT NULL,
  finding_id text NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  corrected_description text NOT NULL CHECK (length(trim(corrected_description)) > 0),
  amended_by_id text REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id, finding_id)
    REFERENCES clinical_findings(organization_id, clinic_id, patient_id, encounter_id, id) ON DELETE RESTRICT
);
CREATE INDEX clinical_finding_amendments_idx
  ON clinical_finding_amendments(organization_id, clinic_id, finding_id, created_at);

CREATE TABLE clinical_procedure_amendments (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  encounter_id text NOT NULL,
  procedure_id text NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  correction_details text NOT NULL CHECK (length(trim(correction_details)) > 0),
  amended_by_id text REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, clinic_id, patient_id, encounter_id, procedure_id)
    REFERENCES clinical_procedures(organization_id, clinic_id, patient_id, encounter_id, id) ON DELETE RESTRICT
);
CREATE INDEX clinical_procedure_amendments_idx
  ON clinical_procedure_amendments(organization_id, clinic_id, procedure_id, created_at);

CREATE FUNCTION prevent_clinical_amendment_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Clinical amendments are append-only'
    USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER clinical_finding_amendments_immutable
  BEFORE UPDATE OR DELETE ON clinical_finding_amendments
  FOR EACH ROW EXECUTE FUNCTION prevent_clinical_amendment_mutation();
CREATE TRIGGER clinical_procedure_amendments_immutable
  BEFORE UPDATE OR DELETE ON clinical_procedure_amendments
  FOR EACH ROW EXECUTE FUNCTION prevent_clinical_amendment_mutation();

CREATE FUNCTION protect_completed_clinical_procedure()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'Completed clinical procedures cannot be changed or deleted; create an amendment'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER clinical_procedures_completed_immutable
  BEFORE UPDATE OR DELETE ON clinical_procedures
  FOR EACH ROW EXECUTE FUNCTION protect_completed_clinical_procedure();

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

ALTER TABLE patient_clinical_history_entries
  ADD CONSTRAINT patient_clinical_history_scope_id_unique
  UNIQUE (organization_id, clinic_id, patient_id, id);

CREATE TABLE patient_clinical_history_amendments (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  history_entry_id text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  corrected_content text NOT NULL CHECK (length(btrim(corrected_content)) BETWEEN 1 AND 8000),
  amended_by_id text NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, clinic_id, patient_id, history_entry_id)
    REFERENCES patient_clinical_history_entries(organization_id, clinic_id, patient_id, id) ON DELETE RESTRICT
);
CREATE INDEX patient_clinical_history_amendments_idx
  ON patient_clinical_history_amendments(organization_id, clinic_id, patient_id, history_entry_id, created_at);

CREATE FUNCTION prevent_patient_history_amendment_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Clinical history amendments are append-only'
    USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER patient_clinical_history_amendments_immutable
  BEFORE UPDATE OR DELETE ON patient_clinical_history_amendments
  FOR EACH ROW EXECUTE FUNCTION prevent_patient_history_amendment_mutation();

CREATE FUNCTION prevent_patient_clinical_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Patient clinical history is immutable; record a correction as an amendment'
    USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER patient_clinical_history_entries_immutable
  BEFORE UPDATE OR DELETE ON patient_clinical_history_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_patient_clinical_history_mutation();

CREATE TABLE organization_invitations (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  role text NOT NULL CHECK (role IN (
    'ORGANIZATION_ADMIN', 'CLINIC_ADMIN', 'DENTIST', 'ORTHODONTIST',
    'HYGIENIST', 'ASSISTANT', 'RECEPTIONIST', 'ACCOUNTANT'
  )),
  clinic_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(clinic_ids) = 'array'),
  token_hash text NOT NULL UNIQUE,
  invited_by_id text REFERENCES app_users(id) ON DELETE SET NULL,
  accepted_by_id text REFERENCES app_users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (accepted_at IS NULL OR revoked_at IS NULL)
);

CREATE INDEX organization_invitations_org_created_idx
  ON organization_invitations (organization_id, created_at DESC);

CREATE UNIQUE INDEX organization_invitations_one_pending_email_idx
  ON organization_invitations (organization_id, invited_email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
