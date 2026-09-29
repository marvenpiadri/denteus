import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { Patient } from '../../core/models/patient.models';
import type { PatientWorkspaceTab } from './patient-workspace.models';
import { PatientWorkspaceTabsComponent } from './patient-workspace-tabs.component';

@Component({
  selector: 'app-patient-workspace-header',
  imports: [MatIconModule, PatientWorkspaceTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="goBack.emit()"
            class="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
            aria-label="Retour à la liste des patients">
            <mat-icon class="text-sm" style="font-size: 18px; width: 18px; height: 18px;">arrow_back</mat-icon>
          </button>

          <div>
            <div class="flex items-center gap-2.5">
              <h1 class="text-xl font-bold text-neutral-900 dark:text-white">
                {{ patient().firstName }} {{ patient().lastName }}
              </h1>
              <span class="text-xs font-mono font-medium text-neutral-400">
                {{ patient().patientNumber }}
              </span>
            </div>
            <div class="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              <span>{{ patient().gender === 'F' ? 'Femme' : 'Homme' }} · {{ calculateAge(patient().birthDate) }} ans</span>
              <span>·</span>
              <span>CIN: {{ patient().cin || 'N/A' }}</span>
              <span>·</span>
              <span>{{ patient().phone }}</span>
              <span>·</span>
              <span>{{ patient().city }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 self-start md:self-auto">
          <div class="text-right">
            <div class="text-[10px] text-neutral-400 uppercase font-semibold">Reste à payer</div>
            <div class="text-sm font-bold font-mono"
              [class.text-amber-600]="patient().balanceDue > 0"
              [class.text-emerald-600]="patient().balanceDue === 0">
              {{ formatCurrency(patient().balanceDue) }}
            </div>
          </div>

          <button
            type="button"
            (click)="tabChange.emit('treatment')"
            class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow-sm transition-colors">
            <mat-icon class="text-xs" style="font-size: 16px; width: 16px; height: 16px;">receipt_long</mat-icon>
            <span>Plans de soins</span>
          </button>
        </div>
      </div>

      @if (patient().medicalAlert.hasHighRisk || patient().medicalAlert.allergies.length > 0) {
        <div class="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-2.5">
          <mat-icon class="text-rose-600 dark:text-rose-400 shrink-0 text-sm mt-0.5">warning</mat-icon>
          <div class="text-xs">
            <span class="font-bold text-rose-800 dark:text-rose-200">Alerte médicale :</span>
            @if (patient().medicalAlert.allergies.length > 0) {
              <span class="font-semibold text-rose-700 dark:text-rose-300 ml-1">
                Allergie(s) : {{ patient().medicalAlert.allergies.join(', ') }}
              </span>
            }
            @if (patient().medicalAlert.medicalConditions.length > 0) {
              <span class="text-rose-700 dark:text-rose-300 ml-2">
                · {{ patient().medicalAlert.medicalConditions.join(', ') }}
              </span>
            }
            @if (patient().medicalAlert.notes) {
              <span class="text-rose-600 dark:text-rose-400 ml-2 italic">
                ({{ patient().medicalAlert.notes }})
              </span>
            }
          </div>
        </div>
      }

      <app-patient-workspace-tabs
        [activeTab]="activeTab()"
        [periodontalCount]="periodontalCount()"
        [treatmentCount]="treatmentCount()"
        [notesCount]="notesCount()"
        (tabChange)="tabChange.emit($event)" />
    </section>
  `,
})
export class PatientWorkspaceHeaderComponent {
  readonly patient = input.required<Patient>();
  readonly activeTab = input.required<PatientWorkspaceTab>();
  readonly periodontalCount = input(0);
  readonly treatmentCount = input(0);
  readonly notesCount = input(0);

  readonly goBack = output<void>();
  readonly tabChange = output<PatientWorkspaceTab>();

  calculateAge(birthDate: string): number {
    if (!birthDate) return 0;
    const date = new Date(birthDate);
    if (Number.isNaN(date.getTime())) return 0;

    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDelta = today.getMonth() - date.getMonth();

    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < date.getDate())) {
      age -= 1;
    }

    return Math.max(age, 0);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
      maximumFractionDigits: 2,
    }).format(value);
  }
}
