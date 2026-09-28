import { Injectable, inject } from '@angular/core';
import { ToothCondition, ToothNumberingSystem } from '../models/dental.models';
import { DentalDataService } from './dental-data.service';

export interface OdontogramToothViewModel {
  toothNumber: number;
  label: string; // e.g. "16" in FDI, "3" in Universal, "UR-6" in Palmer
  isUpper: boolean;
  quadrant: 1 | 2 | 3 | 4;
  condition?: ToothCondition;
  isMissing: boolean;
  isImplant: boolean;
  hasCaries: boolean;
  hasFilling: boolean;
  hasCrown: boolean;
  isEndoTreated: boolean;
  surfaces: string[];
  statusColor: string;
}

@Injectable({
  providedIn: 'root',
})
export class OdontogramAdapterService {
  private readonly dataService = inject(DentalDataService);

  // Convert FDI tooth number to current numbering system label
  formatToothNumber(fdi: number, system: ToothNumberingSystem = this.dataService.numberingSystem()): string {
    if (system === 'FDI') return `${fdi}`;

    // Universal ADA system mapping (1-32)
    const fdiToUniversal: Record<number, string> = {
      18: '1', 17: '2', 16: '3', 15: '4', 14: '5', 13: '6', 12: '7', 11: '8',
      21: '9', 22: '10', 23: '11', 24: '12', 25: '13', 26: '14', 27: '15', 28: '16',
      38: '17', 37: '18', 36: '19', 35: '20', 34: '21', 33: '22', 32: '23', 31: '24',
      41: '25', 42: '26', 43: '27', 44: '28', 45: '29', 46: '30', 47: '31', 48: '32',
    };
    if (system === 'UNIVERSAL') {
      return fdiToUniversal[fdi] || `${fdi}`;
    }

    // Palmer notation (Quadrant + position 1-8)
    const quadrant = Math.floor(fdi / 10);
    const pos = fdi % 10;
    const prefix = quadrant === 1 ? 'UR' : quadrant === 2 ? 'UL' : quadrant === 3 ? 'LL' : 'LR';
    return `${prefix}-${pos}`;
  }

  // Generate view models for all 32 adult teeth
  buildTeethViewModels(conditions: ToothCondition[]): { upper: OdontogramToothViewModel[]; lower: OdontogramToothViewModel[] } {
    const upperTeethNumbers = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
    const lowerTeethNumbers = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

    const conditionMap = new Map<number, ToothCondition>();
    for (const c of conditions) {
      conditionMap.set(c.toothNumber, c);
    }

    const mapTooth = (num: number, isUpper: boolean): OdontogramToothViewModel => {
      const cond = conditionMap.get(num);
      const isMissing = cond?.condition === 'missing';
      const isImplant = cond?.condition === 'implant';
      const hasCaries = cond?.condition === 'caries';
      const hasFilling = cond?.condition === 'filling';
      const hasCrown = cond?.condition === 'crown';
      const isEndoTreated = cond?.condition === 'endo_treated';

      let statusColor = '#94a3b8'; // Default neutral
      if (hasCaries) statusColor = '#ef4444'; // Red for caries
      else if (hasFilling) statusColor = '#3b82f6'; // Blue for restoration
      else if (hasCrown) statusColor = '#f59e0b'; // Amber for crown
      else if (isImplant) statusColor = '#06b6d4'; // Cyan for implant
      else if (isEndoTreated) statusColor = '#8b5cf6'; // Purple for endo
      else if (isMissing) statusColor = '#64748b'; // Muted dark for missing

      return {
        toothNumber: num,
        label: this.formatToothNumber(num),
        isUpper,
        quadrant: Math.floor(num / 10) as 1 | 2 | 3 | 4,
        condition: cond,
        isMissing,
        isImplant,
        hasCaries,
        hasFilling,
        hasCrown,
        isEndoTreated,
        surfaces: cond?.surfaces || [],
        statusColor,
      };
    };

    return {
      upper: upperTeethNumbers.map((num) => mapTooth(num, true)),
      lower: lowerTeethNumbers.map((num) => mapTooth(num, false)),
    };
  }

  // Export Denteus structured conditions to third-party library JSON payload format
  toLibraryPayload(conditions: ToothCondition[]): Record<string, unknown> {
    const teethPayload: Record<string, unknown> = {};

    for (const cond of conditions) {
      const toothKey = String(cond.toothNumber);
      const record: Record<string, unknown> = {};

      if (cond.condition === 'missing') {
        record['toothSelection'] = 'none';
      } else if (cond.condition === 'implant') {
        record['toothSelection'] = 'implant';
      } else if (cond.condition === 'caries') {
        record['caries'] = cond.surfaces;
        record['cariesActiveDepth'] = cond.severity || 2;
      } else if (cond.condition === 'filling') {
        record['fillingSurfaces'] = cond.surfaces;
        record['fillingMaterial'] = 'composite';
      } else if (cond.condition === 'crown') {
        record['prosthesis'] = 'crown';
      } else if (cond.condition === 'endo_treated') {
        record['endo'] = 'obturated';
      }

      teethPayload[toothKey] = record;
    }

    return {
      version: '2.6.0',
      teeth: teethPayload,
    };
  }
}
