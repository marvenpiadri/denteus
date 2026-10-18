-- The treating clinician is a clinic provider, not necessarily a user account.
DROP INDEX clinical_encounters_dentist_timeline_idx;
ALTER TABLE clinical_encounters ADD COLUMN responsible_provider_id text;

UPDATE clinical_encounters e
SET responsible_provider_id = provider.id
FROM clinic_providers provider
WHERE provider.organization_id = e.organization_id
  AND provider.clinic_id = e.clinic_id
  AND provider.user_id = e.responsible_dentist_id
  AND provider.role IN ('DENTIST', 'ORTHODONTIST');

ALTER TABLE clinical_encounters DROP COLUMN responsible_dentist_id;
ALTER TABLE clinical_encounters
  ADD CONSTRAINT clinical_encounters_responsible_provider_fk
  FOREIGN KEY (organization_id, clinic_id, responsible_provider_id)
  REFERENCES clinic_providers(organization_id, clinic_id, id) ON DELETE RESTRICT;

CREATE INDEX clinical_encounters_provider_timeline_idx
  ON clinical_encounters(organization_id, clinic_id, responsible_provider_id, started_at DESC);
