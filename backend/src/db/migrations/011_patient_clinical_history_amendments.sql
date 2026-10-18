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
