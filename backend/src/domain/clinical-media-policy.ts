export type ClinicalMediaType = 'XRAY' | 'PHOTO' | 'DOCUMENT';
export const maxClinicalMediaBytes = 8 * 1024 * 1024;
export const allowedClinicalMimeTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/dicom',
]);

const categoryTypes: Record<ClinicalMediaType, readonly string[]> = {
  XRAY: ['image/jpeg', 'image/png', 'image/webp', 'application/dicom'],
  PHOTO: ['image/jpeg', 'image/png', 'image/webp'],
  DOCUMENT: ['application/pdf'],
};

export function isClinicalMediaCategoryCompatible(category: ClinicalMediaType, mimeType: string): boolean {
  return categoryTypes[category].includes(mimeType);
}

export function safeClinicalFilename(value: string): string {
  return value.replaceAll('/', '_').replaceAll(String.fromCharCode(92), '_')
    .replace(/[\r\n\0]/g, '_')
    .replace(/[^\p{L}\p{N}._ ()-]/gu, '_')
    .slice(0, 255) || 'clinical-file';
}

export function isValidClinicalBase64(value: string): boolean {
  return value.length > 0 &&
    value.length <= Math.ceil(maxClinicalMediaBytes * 4 / 3) + 8 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

export function matchesClinicalFileSignature(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (mimeType === 'application/pdf') return bytes.length >= 5 && bytes.toString('ascii', 0, 5) === '%PDF-';
  if (mimeType === 'application/dicom') return bytes.length >= 132 && bytes.toString('ascii', 128, 132) === 'DICM';
  return false;
}
