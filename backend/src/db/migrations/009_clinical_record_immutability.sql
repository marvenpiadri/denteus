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
