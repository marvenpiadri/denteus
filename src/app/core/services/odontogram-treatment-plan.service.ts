import { Injectable } from '@angular/core';
import { OdontogramPlanChange } from './odontogram-persistence.service';
import { DentalProcedure, ProcedureCategory, TreatmentPlanItem } from '../models/treatment.models';

export interface OdontogramTreatmentCandidate {
  toothNumber: number;
  axis: string;
  from: unknown;
  to: unknown;
  procedureCode: string;
  procedureName: string;
  category: ProcedureCategory;
  suggestedFee: number;
  suggestedDurationMinutes: number;
}

const AXIS_MAP: Record<string, { code: string; name: string; category: ProcedureCategory }> = {
  restoration: { code: 'REST', name: 'Restauration dentaire', category: 'soins_conservateurs' },
  prosthesis: { code: 'PROS', name: 'Prothèse dentaire', category: 'prothese' },
  crownAction: { code: 'CRN-ZR', name: 'Couronne dentaire', category: 'prothese' },
  pulpEndo: { code: 'ENDO', name: 'Traitement endodontique', category: 'endodontie' },
  apical: { code: 'ENDO-AP', name: 'Traitement endodontique / apical', category: 'endodontie' },
  presence: { code: 'IMP-TIT', name: 'Implantologie / remplacement dentaire', category: 'implantologie' },
  substrate: { code: 'REST', name: 'Restauration dentaire', category: 'soins_conservateurs' },
  ortho: { code: 'ORTHO', name: 'Traitement orthodontique', category: 'esthetique' },
};

@Injectable({ providedIn: 'root' })
export class OdontogramTreatmentPlanService {
  getCandidates(changes: OdontogramPlanChange[], procedures: DentalProcedure[]): OdontogramTreatmentCandidate[] {
    return changes.flatMap((change) => {
      const mapping = AXIS_MAP[change.axis];
      if (!mapping) return [];

      const procedure = procedures.find((item) => item.code === mapping.code);
      const fallback = procedure ?? {
        id: '',
        code: mapping.code,
        name: mapping.name,
        category: mapping.category,
        defaultFee: 0,
        durationMinutes: 30,
        requiresTooth: true,
        isActive: true,
      };

      return [{
        toothNumber: change.toothNo,
        axis: change.axis,
        from: change.from,
        to: change.to,
        procedureCode: fallback.code,
        procedureName: fallback.name,
        category: fallback.category,
        suggestedFee: fallback.defaultFee,
        suggestedDurationMinutes: fallback.durationMinutes,
      }];
    });
  }

  buildItems(
    planId: string,
    candidates: OdontogramTreatmentCandidate[],
  ): TreatmentPlanItem[] {
    return candidates.map((candidate, index) => ({
      id: `otp-${Date.now()}-${index}`,
      planId,
      toothNumber: candidate.toothNumber,
      procedureCode: candidate.procedureCode,
      procedureName: candidate.procedureName,
      category: candidate.category,
      fee: candidate.suggestedFee,
      status: 'pending',
      notes: `Origine odontogramme · axe ${candidate.axis}`,
    }));
  }
}
