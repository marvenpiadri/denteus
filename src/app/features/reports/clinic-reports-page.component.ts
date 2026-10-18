import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { firstValueFrom } from 'rxjs';

interface ReportData {
  period: { from: string; to: string };
  appointments: { total: number; byStatus: Record<string, number>; completed: number; cancelled: number; noShow: number; completionRate: number | null };
  patients: { total: number; added: number };
  recalls: { overdue: number; due_in_period: number; completed: number };
  trend: Array<{ day: string; total: number; completed: number; cancelled: number; no_show: number }>;
}
interface ReportResponse { data: ReportData; }

@Component({
  selector: 'app-clinic-reports-page',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clinic-reports-page.component.html',
  styleUrl: './clinic-reports-page.component.css',
})
export class ClinicReportsPageComponent {
  readonly tenant = inject(TenantContextService);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly report = signal<ReportData | null>(null);
  from = '';
  to = '';
  private context = '';
  private sequence = 0;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const today = new Date();
      this.to = this.localDate(today);
      this.from = this.localDate(new Date(today.getFullYear(), today.getMonth(), 1));
    }
    effect(() => {
      const clinic = this.tenant.activeClinic();
      if (!isPlatformBrowser(this.platformId)) return;
      if (!clinic) {
        this.context = '';
        this.report.set(null);
        this.error.set('Sélectionnez une clinique autorisée pour consulter ses rapports.');
        return;
      }
      const key = clinic.organizationId + ':' + clinic.id;
      if (key === this.context) return;
      this.context = key;
      void this.load();
    });
  }

  private localDate(date: Date): string {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  async load(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic || this.loading()) return;
    if (!this.from || !this.to || this.from > this.to) {
      this.error.set('La date de début doit précéder ou correspondre à la date de fin.');
      return;
    }
    const seq = ++this.sequence;
    this.loading.set(true);
    this.error.set('');
    try {
      const params = new URLSearchParams({ from: this.from, to: this.to });
      const response = await firstValueFrom(this.http.get<ReportResponse>(
        `/api/v1/organizations/${encodeURIComponent(clinic.organizationId)}/clinics/${encodeURIComponent(clinic.id)}/reports/overview?${params}`,
        { withCredentials: true },
      ));
      if (seq !== this.sequence || this.tenant.activeClinic()?.id !== clinic.id) return;
      this.report.set(response.data);
    } catch (error) {
      if (seq === this.sequence) this.error.set(error instanceof HttpErrorResponse && error.status === 403
        ? 'Votre rôle ne permet pas de consulter ces rapports.'
        : 'Les indicateurs ne peuvent pas être chargés pour cette période.');
    } finally {
      if (seq === this.sequence) this.loading.set(false);
    }
  }

  get maxDailyAppointments(): number {
    return Math.max(1, ...this.report()?.trend.map((day) => day.total) ?? []);
  }

  formatDay(day: string): string {
    const [year, month, date] = day.split('-').map(Number);
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, date)));
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      SCHEDULED: 'Planifiés', CONFIRMED: 'Confirmés', ARRIVED: 'Arrivés',
      IN_PROGRESS: 'En cours', COMPLETED: 'Terminés', CANCELLED: 'Annulés', NO_SHOW: 'Absences',
    };
    return labels[status] ?? status;
  }
}
