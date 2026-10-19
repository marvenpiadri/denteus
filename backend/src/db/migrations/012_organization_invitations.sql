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
