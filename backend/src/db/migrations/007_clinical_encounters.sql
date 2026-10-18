-- Encounter-centered clinical history. Odontograms remain the current-state view.
ALTER TABLE appointments ADD CONSTRAINT appointments_org_clinic_patient_id_unique UNIQUE (organization_id, clinic_id, patient_id, id);

CREATE TABLE clinical_encounters (
 id text PRIMARY KEY, organization_id text NOT NULL, clinic_id text NOT NULL, patient_id text NOT NULL, appointment_id text,
 status text NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('DRAFT','IN_PROGRESS','SIGNED','CANCELLED')),
 encounter_type text NOT NULL DEFAULT 'CONSULTATION' CHECK (encounter_type IN ('CONSULTATION','EMERGENCY','FOLLOW_UP','PROCEDURE','OTHER')),
 responsible_dentist_id text REFERENCES app_users(id) ON DELETE RESTRICT,
 started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz, chief_complaint text,
 created_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, updated_by_id text REFERENCES app_users(id) ON DELETE RESTRICT,
 signed_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, signed_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id, clinic_id, patient_id, id),
 CHECK (ended_at IS NULL OR ended_at >= started_at),
 CHECK ((status = 'SIGNED') = (signed_at IS NOT NULL)),
 CHECK ((status = 'SIGNED') = (signed_by_id IS NOT NULL)),
 FOREIGN KEY (organization_id, clinic_id) REFERENCES clinics(organization_id, id) ON DELETE CASCADE,
 FOREIGN KEY (organization_id, patient_id, clinic_id) REFERENCES patient_clinics(organization_id, patient_id, clinic_id) ON DELETE CASCADE,
 FOREIGN KEY (organization_id, clinic_id, patient_id, appointment_id) REFERENCES appointments(organization_id, clinic_id, patient_id, id) ON DELETE RESTRICT
);
CREATE INDEX clinical_encounters_patient_timeline_idx ON clinical_encounters(organization_id, clinic_id, patient_id, started_at DESC, created_at DESC);
CREATE INDEX clinical_encounters_dentist_timeline_idx ON clinical_encounters(organization_id, clinic_id, responsible_dentist_id, started_at DESC);
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
 storage_key text NOT NULL CHECK (length(trim(storage_key)) > 0), original_filename text, mime_type text NOT NULL,
 size_bytes bigint NOT NULL CHECK (size_bytes > 0), checksum_sha256 char(64), captured_at timestamptz, description text,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb, uploaded_by_id text REFERENCES app_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id, clinic_id, storage_key), UNIQUE (organization_id, clinic_id, patient_id, encounter_id, id),
 CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'),
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
