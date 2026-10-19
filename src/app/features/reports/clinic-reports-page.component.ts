import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KeyValuePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  imports: [FormsModule, KeyValuePipe, RouterLink],
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
      if (!this.from || !this.to) {
        this.to = this.todayInTimezone(clinic.timezone || 'Africa/Casablanca');
        this.from = this.to.slice(0, 7) + '-01';
      }
      this.report.set(null);
      void this.load();
    });
  }

  private todayInTimezone(timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
    return part('year') + '-' + part('month') + '-' + part('day');
  }

  get periodInvalid(): boolean {
    if (!this.from || !this.to || this.from > this.to) return true;
    const start = Date.parse(this.from + 'T00:00:00Z');
    const end = Date.parse(this.to + 'T00:00:00Z');
    return !Number.isFinite(start) || !Number.isFinite(end) || end - start > 366 * 24 * 60 * 60 * 1000;
  }

  async load(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    if (!clinic) return;
    if (this.periodInvalid) {
      this.report.set(null);
      this.error.set('Choisissez une période valide, du début à la fin, de 367 jours maximum.');
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

  exportCsv(): void {
    const data = this.report();
    if (!data || !isPlatformBrowser(this.platformId)) return;

    const rows: string[][] = [
      ['Rapport d’activité Dentaleus'],
      ['Clinique', this.tenant.activeClinic()?.name ?? ''],
      ['Du', data.period.from, 'Au', data.period.to],
      [],
      ['Indicateur', 'Valeur'],
      ['Rendez-vous total', String(data.appointments.total)],
      ['Rendez-vous terminés', String(data.appointments.completed)],
      ['Rendez-vous annulés', String(data.appointments.cancelled)],
      ['Absences', String(data.appointments.noShow)],
      ['Taux de réalisation (%)', data.appointments.completionRate === null ? '' : String(data.appointments.completionRate)],
      ['Patients rattachés', String(data.patients.total)],
      ['Nouveaux patients', String(data.patients.added)],
      ['Rappels en retard à la fin de la période', String(data.recalls.overdue)],
      ['Rappels dus pendant la période', String(data.recalls.due_in_period)],
      ['Rappels terminés pendant la période', String(data.recalls.completed)],
      [],
      ['Statut des rendez-vous', 'Nombre'],
      ...Object.entries(data.appointments.byStatus).map(([status, count]) => [this.statusLabel(status), String(count)]),
      [],
      ['Date', 'Rendez-vous', 'Terminés', 'Annulés', 'Absences'],
      ...data.trend.map((day) => [day.day, String(day.total), String(day.completed), String(day.cancelled), String(day.no_show)]),
    ];

    const csv = rows.map((row) => row.map((value) => {
      const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
      return '"' + safe.replace(/"/g, '""') + '"';
    }).join(';')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dentaleus-rapport-' + data.period.from + '-' + data.period.to + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  get maxDailyAppointments(): number {
    const trend = this.report()?.trend ?? [];
    return Math.max(1, ...trend.map((day) => day.total));
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
