import { Injectable } from '@angular/core';
import {
  getCaseMeta,
  getOdontogramSummary,
  getPerioChart,
  getPerioSummary,
  getPlanChanges,
  getPlanChart,
  getStatusChart,
  importStatus,
  onStateChange,
  setPlanChart,
} from 'angular-advanced-odontogram';

interface StoredOdontogram {
  patientId: string;
  organizationId: string;
  clinicId: string;
  status: Record<string, unknown>;
  plan: Record<string, unknown> | null;
  planChanges: Array<{
    toothNo: number;
    axis: string;
    from: unknown;
    to: unknown;
  }>;
  updatedAt: string;
  updatedBy: string;
}

interface ApiResponse<T> {
  data: T;
}

/**
 * Owns the bridge between the Angular clinical workspace and the odontogram
 * engine's canonical chart state.
 *
 * The odontogram engine remains responsible for dental chart semantics.
 * Denteus is responsible for associating that case with a patient and
 * persisting it through the backend.
 */
@Injectable({ providedIn: 'root' })
export class OdontogramPersistenceService {
  private unsubscribeStateChange: (() => void) | null = null;
  private patientId: string | null = null;
  private hydrating = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  async attach(
    patientId: string,
    organizationId: string,
    clinicId: string,
    updatedBy: string,
  ): Promise<void> {
    this.detach();

    this.patientId = patientId;

    try {
      const response = await fetch(`/api/v1/patients/${encodeURIComponent(patientId)}/odontogram`);
      if (response.ok) {
        const payload = (await response.json()) as ApiResponse<StoredOdontogram | null>;
        if (payload.data) {
          this.hydrate(payload.data);
        }
      }
    } catch (error) {
      // A failed persistence request must not prevent a dentist from charting.
      console.warn('Denteus odontogram load failed:', error);
    }

    this.unsubscribeStateChange = onStateChange(() => {
      if (!this.hydrating) {
        this.scheduleSave(patientId, organizationId, clinicId, updatedBy);
      }
    });
  }

  detach(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    this.unsubscribeStateChange?.();
    this.unsubscribeStateChange = null;
    this.patientId = null;
  }

  private hydrate(record: StoredOdontogram): void {
    this.hydrating = true;

    try {
      importStatus(record.status);

      if (record.plan) {
        setPlanChart(record.plan);
      }
    } finally {
      this.hydrating = false;
    }
  }

  private scheduleSave(
    patientId: string,
    organizationId: string,
    clinicId: string,
    updatedBy: string,
  ): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      void this.save(patientId, organizationId, clinicId, updatedBy);
    }, 500);
  }

  private async save(
    patientId: string,
    organizationId: string,
    clinicId: string,
    updatedBy: string,
  ): Promise<void> {
    if (this.patientId !== patientId) return;

    const status = getStatusChart() as unknown as Record<string, unknown>;
    const plan = getPlanChart() as unknown as Record<string, unknown> | null;

    const body = {
      organizationId,
      clinicId,
      status,
      plan,
      planChanges: getPlanChanges(),
      summary: getOdontogramSummary(),
      perio: {
        summary: getPerioSummary(),
        chart: getPerioChart(),
      },
      caseMeta: getCaseMeta(),
      updatedBy,
    };

    try {
      await fetch(`/api/v1/patients/${encodeURIComponent(patientId)}/odontogram`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.warn('Denteus odontogram save failed:', error);
    }
  }
}
