ALTER TABLE clinical_media
  ADD COLUMN IF NOT EXISTS content_bytes bytea;

ALTER TABLE clinical_media
  ALTER COLUMN storage_key DROP NOT NULL;

COMMENT ON COLUMN clinical_media.content_bytes IS
  'Private clinical file bytes. Served only through authenticated clinic-scoped API routes.';
