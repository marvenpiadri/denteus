/**
 * Dentaleus clinical backend boundary.
 *
 * This module intentionally contains no Express/Angular code. It can be moved
 * into the future standalone Node/Fastify server without changing the clinical
 * data contract.
 *
 * The odontogram library is the clinical chart engine. Dentaleus stores its
 * versioned JSON status/plan payloads as the canonical dental chart, while
 * treatment-plan records remain separate for billing, scheduling and workflow.
 */

export type JsonObject = Record<string, unknown>;

export interface OdontogramRecord {
  patientId: string;
  organizationId: string;
  clinicId: string;
  status: JsonObject;
  plan: JsonObject | null;
  planChanges: Array<{
    toothNo: number;
    axis: string;
    from: unknown;
    to: unknown;
  }>;
  updatedAt: string;
  updatedBy: string;
}

export interface SaveOdontogramInput {
  organizationId: string;
  clinicId: string;
  status: JsonObject;
  plan?: JsonObject | null;
  planChanges?: OdontogramRecord['planChanges'];
  updatedBy: string;
}

const records = new Map<string, OdontogramRecord>();

export function getOdontogram(patientId: string): OdontogramRecord | null {
  return records.get(patientId) ?? null;
}

export function saveOdontogram(
  patientId: string,
  input: SaveOdontogramInput,
): OdontogramRecord {
  const record: OdontogramRecord = {
    patientId,
    organizationId: input.organizationId,
    clinicId: input.clinicId,
    status: input.status,
    plan: input.plan ?? null,
    planChanges: input.planChanges ?? [],
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  };

  records.set(patientId, record);
  return record;
}

export function deleteOdontogram(patientId: string): boolean {
  return records.delete(patientId);
}
