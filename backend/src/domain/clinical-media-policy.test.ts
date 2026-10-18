import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedClinicalMimeTypes, isClinicalMediaCategoryCompatible, isValidClinicalBase64,
  matchesClinicalFileSignature, maxClinicalMediaBytes, safeClinicalFilename,
} from './clinical-media-policy.js';

test('clinical media categories only accept compatible formats', () => {
  assert.equal(isClinicalMediaCategoryCompatible('XRAY', 'image/jpeg'), true);
  assert.equal(isClinicalMediaCategoryCompatible('XRAY', 'application/dicom'), true);
  assert.equal(isClinicalMediaCategoryCompatible('PHOTO', 'application/pdf'), false);
  assert.equal(isClinicalMediaCategoryCompatible('DOCUMENT', 'application/pdf'), true);
  assert.equal(isClinicalMediaCategoryCompatible('XRAY', 'application/dicom'), true);
  assert.equal(allowedClinicalMimeTypes.has('text/html'), false);
});

test('file signatures must match declared media types', () => {
  assert.equal(matchesClinicalFileSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg'), true);
  assert.equal(matchesClinicalFileSignature(Buffer.from('%PDF-1.7'), 'application/pdf'), true);
  assert.equal(matchesClinicalFileSignature(Buffer.from('<html>'), 'application/pdf'), false);
  const dicom = Buffer.alloc(132); dicom.write('DICM', 128, 'ascii');
  assert.equal(matchesClinicalFileSignature(dicom, 'application/dicom'), true);
});

test('base64 and filenames are constrained before persistence', () => {
  assert.equal(isValidClinicalBase64('aGVsbG8='), true);
  assert.equal(isValidClinicalBase64('not base64!'), false);
  assert.equal(isValidClinicalBase64(''), false);
  assert.equal(maxClinicalMediaBytes, 8 * 1024 * 1024);
  assert.equal(safeClinicalFilename('../scan\r\n.pdf').includes('/'), false);
  assert.equal(safeClinicalFilename('scan.pdf'), 'scan.pdf');
});
