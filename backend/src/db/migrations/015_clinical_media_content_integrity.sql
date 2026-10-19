ALTER TABLE clinical_media
  ADD CONSTRAINT clinical_media_content_size_matches
  CHECK (
    content_bytes IS NULL
    OR (
      octet_length(content_bytes) = size_bytes
      AND octet_length(content_bytes) BETWEEN 1 AND 8388608
    )
  );

ALTER TABLE clinical_media
  ADD CONSTRAINT clinical_media_content_checksum_required
  CHECK (content_bytes IS NULL OR checksum_sha256 IS NOT NULL);
