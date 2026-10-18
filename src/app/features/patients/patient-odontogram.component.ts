import { DatePipe, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, ChangeDetectionStrategy, Component, PLATFORM_ID, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OdontogramShellComponent, getPlanChart, getPlanChanges, getStatusChart, importStatus, onStateChange, setPlanChart } from 'angular-advanced-odontogram';
import { TenantContextService } from '../../core/tenant/tenant-context.service';

interface OdontogramRecord {
  status: Record<string, unknown>;
  plan: Record<string, unknown> | null;
  planChanges: Array<{ toothNo: number; axis: string; from?: unknown; to?: unknown }>;
  updatedAt?: string;
}
interface OdontogramRevision {
  versionNo: number;
  recordedByName: string | null;
  createdAt: string;
}

@Component({
  selector: 'app-patient-odontogram',
  imports: [DatePipe, OdontogramShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './patient-odontogram.component.html',
  styleUrl: './patient-odontogram.component.css',
})
export class PatientOdontogramComponent implements AfterViewInit {
  readonly patientId = input.required<string>();
  readonly tenant = inject(TenantContextService);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  readonly ready = signal(false);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saveError = signal('');
  readonly saveConflict = signal(false);
  readonly lastSavedAt = signal<string | null>(null);
  readonly revisions = signal<OdontogramRevision[]>([]);
  readonly revisionsLoading = signal(false);
  readonly revisionsError = signal('');
  private requestSequence = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeState: (() => void) | null = null;
  private activeContext = '';
  private applyingServerState = false;
  private saveInFlight = false;
  private saveQueued = false;

  constructor() {
    effect(() => {
      const clinic = this.tenant.activeClinic();
      const patientId = this.patientId();
      if (!this.ready() || !isPlatformBrowser(this.platformId)) return;
      if (!clinic || !patientId) {
        this.activeContext = '';
        this.loaded.set(false);
        this.revisions.set([]);
        this.error.set('Sélectionnez une clinique autorisée pour ouvrir le dossier dentaire.');
        return;
      }
      const context = `${clinic.organizationId}:${clinic.id}:${patientId}`;
      if (context === this.activeContext) return;
      this.activeContext = context;
      this.loaded.set(false);
      this.error.set('');
      this.saveError.set('');
      this.revisions.set([]);
      this.cancelScheduledSave();
      void this.load(context, clinic.organizationId, clinic.id, patientId);
    });
  }

  ngAfterViewInit(): void {
    this.unsubscribeState = onStateChange(() => {
      if (!this.applyingServerState && this.loaded() && this.activeContext) this.scheduleSave();
    });
    this.ready.set(true);
  }

  ngOnDestroy(): void {
    this.cancelScheduledSave();
    this.unsubscribeState?.();
  }

  async load(context: string, organizationId: string, clinicId: string, patientId: string): Promise<void> {
    const sequence = ++this.requestSequence;
    this.loading.set(true);
    const base = this.collectionUrl(organizationId, clinicId, patientId);
    try {
      const response = await firstValueFrom(this.http.get<{ data: OdontogramRecord | null }>(base, { withCredentials: true }));
      if (sequence !== this.requestSequence || context !== this.activeContext) return;
      this.applyingServerState = true;
      try {
        if (response.data?.status) {
          importStatus(response.data.status);
          setPlanChart(response.data.plan ?? { version: '2.22', teeth: {}, globals: {} });
          this.lastSavedAt.set(response.data.updatedAt ?? null);
        } else {
          // Reset through the upstream engine so a route reused for another patient
          // never displays the previous patient's clinical chart.
          importStatus({ version: '2.22', teeth: {}, globals: {} });
          setPlanChart({ version: '2.22', teeth: {}, globals: {} });
          this.lastSavedAt.set(null);
        }
      } finally {
        this.applyingServerState = false;
      }
      this.loaded.set(true);
      void this.loadRevisions(base, sequence);
    } catch (error) {
      if (sequence !== this.requestSequence || context !== this.activeContext) return;
      this.error.set(error instanceof HttpErrorResponse && error.status === 403
        ? 'Votre rôle ne permet pas de consulter l’odontogramme de cette clinique.'
        : error instanceof HttpErrorResponse && error.status === 404
          ? 'Ce patient n’est pas rattaché à la clinique active.'
          : 'Impossible de charger l’odontogramme. Vérifiez votre connexion puis réessayez.');
    } finally {
      if (sequence === this.requestSequence && context === this.activeContext) this.loading.set(false);
    }
  }

  async retry(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    const patientId = this.patientId();
    if (!clinic || !patientId) return;
    const context = `${clinic.organizationId}:${clinic.id}:${patientId}`;
    this.activeContext = context;
    this.cancelScheduledSave();
    this.saveQueued = false;
    this.saveError.set('');
    this.saveConflict.set(false);
    this.loaded.set(false);
    await this.load(context, clinic.organizationId, clinic.id, patientId);
  }

  private async loadRevisions(base: string, sequence: number): Promise<void> {
    this.revisionsLoading.set(true);
    this.revisionsError.set('');
    try {
      const response = await firstValueFrom(this.http.get<{ data: OdontogramRevision[] }>(`${base}/revisions`, { withCredentials: true }));
      if (sequence === this.requestSequence) this.revisions.set(response.data ?? []);
    } catch {
      if (sequence === this.requestSequence) this.revisionsError.set('L’historique des versions est momentanément indisponible.');
    } finally {
      if (sequence === this.requestSequence) this.revisionsLoading.set(false);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.persistCurrentState();
    }, 700);
  }

  private cancelScheduledSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }

  private async persistCurrentState(): Promise<void> {
    if (this.saveInFlight) { this.saveQueued = true; return; }
    const clinic = this.tenant.activeClinic();
    const patientId = this.patientId();
    const context = this.activeContext;
    if (!clinic || !patientId || !this.loaded() || !context) return;
    this.saveInFlight = true;
    this.saving.set(true);
    this.saveError.set('');
    this.saveConflict.set(false);
    const base = this.collectionUrl(clinic.organizationId, clinic.id, patientId);
    try {
      const response = await firstValueFrom(this.http.put<{ data: OdontogramRecord }>(base, {
        status: getStatusChart() as unknown as Record<string, unknown>,
        plan: getPlanChart() as unknown as Record<string, unknown> | null,
        planChanges: getPlanChanges() as unknown as Array<{ toothNo: number; axis: string; from?: unknown; to?: unknown }>,
        extra: { source: 'angular-advanced-odontogram', schemaVersion: '2.6.0' },
        expectedUpdatedAt: this.lastSavedAt(),
      }, { withCredentials: true }));
      if (context !== this.activeContext) return;
      this.lastSavedAt.set(response.data?.updatedAt ?? new Date().toISOString());
      void this.loadRevisions(base, this.requestSequence);
    } catch (error) {
      if (context !== this.activeContext) return;
      const conflict = error instanceof HttpErrorResponse && error.status === 409;
      this.saveConflict.set(conflict);
      this.saveError.set(error instanceof HttpErrorResponse && error.status === 403
        ? 'Votre rôle ne permet pas d’enregistrer les modifications dentaires.'
        : conflict
          ? 'Cet odontogramme a changé dans une autre session. Rechargez la dernière version avant de reprendre vos modifications.'
          : 'Les modifications ne sont pas enregistrées. Réessayez avant de quitter ce dossier.');
    } finally {
      this.saveInFlight = false;
      this.saving.set(false);
      if (this.saveConflict()) this.saveQueued = false;
      else if (this.saveQueued) { this.saveQueued = false; this.scheduleSave(); }
    }
  }

  private collectionUrl(organizationId: string, clinicId: string, patientId: string): string {
    return `/api/v1/organizations/${encodeURIComponent(organizationId)}/clinics/${encodeURIComponent(clinicId)}/patients/${encodeURIComponent(patientId)}/odontogram`;
  }
}
