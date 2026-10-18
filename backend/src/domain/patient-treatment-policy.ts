export type TreatmentStatus = 'PLANNED' | 'ACCEPTED' | 'COMPLETED' | 'DECLINED';
export type ToothSurface = 'WHOLE' | 'OCCLUSAL' | 'INCISAL' | 'MESIAL' | 'DISTAL' | 'BUCCAL' | 'LINGUAL' | 'PALATAL' | 'CERVICAL';

const validFdiTeeth = new Set([
  11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,
  31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48,
  51,52,53,54,55,61,62,63,64,65,71,72,73,74,75,81,82,83,84,85,
]);
const validSurfaces = new Set<ToothSurface>(['WHOLE','OCCLUSAL','INCISAL','MESIAL','DISTAL','BUCCAL','LINGUAL','PALATAL','CERVICAL']);

export function isValidFdiTooth(toothNo: number): boolean {
  return validFdiTeeth.has(toothNo);
}

export function isValidToothSurface(surface: string): surface is ToothSurface {
  return validSurfaces.has(surface as ToothSurface);
}

export function isValidToothSurfaceForTooth(toothNo: number, surface: string): boolean {
  if (!isValidFdiTooth(toothNo) || !isValidToothSurface(surface)) return false;
  if (surface === 'INCISAL') return [1, 2, 3].includes(toothNo % 10);
  if (surface === 'OCCLUSAL') return toothNo % 10 >= 4;
  if (surface === 'PALATAL') return [1, 2, 5, 6].includes(Math.floor(toothNo / 10));
  if (surface === 'LINGUAL') return [3, 4, 7, 8].includes(Math.floor(toothNo / 10));
  return true;
}

export function canTransitionTreatmentStatus(from: TreatmentStatus, to: TreatmentStatus): boolean {
  const transitions: Record<TreatmentStatus, TreatmentStatus[]> = {
    PLANNED: ['ACCEPTED', 'COMPLETED', 'DECLINED'],
    ACCEPTED: ['COMPLETED', 'DECLINED'],
    COMPLETED: [],
    DECLINED: [],
  };
  return transitions[from].includes(to);
}
