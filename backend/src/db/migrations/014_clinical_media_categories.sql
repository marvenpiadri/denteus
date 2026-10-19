ALTER TABLE clinical_media
  DROP CONSTRAINT IF EXISTS clinical_media_media_type_check;

ALTER TABLE clinical_media
  ADD CONSTRAINT clinical_media_media_type_check
  CHECK (media_type IN (
    'INTRAORAL_XRAY',
    'PANORAMIC_XRAY',
    'CBCT',
    'INTRAORAL_PHOTO',
    'EXTRAORAL_PHOTO',
    'SCAN',
    'DOCUMENT',
    'OTHER',
    'XRAY',
    'PHOTO'
  ));
