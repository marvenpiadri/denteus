ALTER TABLE clinical_media
  ADD CONSTRAINT clinical_media_storage_source_required
  CHECK (content_bytes IS NOT NULL OR storage_key IS NOT NULL);

ALTER TABLE clinical_media
  ADD CONSTRAINT clinical_media_content_checksum_format
  CHECK (
    content_bytes IS NULL
    OR checksum_sha256 ~ '^[0-9a-f]{64}$'
  );
