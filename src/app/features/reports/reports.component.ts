import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { DentalDataService } from '../../core/services/dental-data.service';
import { TenantService } from '../../core/services/tenant.service';

@Component({
  selector: 'app-reports',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 class="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <mat-icon class="text-teal-600 dark:text-teal-400">analytics</mat-icon>
            <span>Rapports d'Activité & Statistiques Cliniques</span>
          </h1>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Tableau de bord de performance médico-économique pour {{ tenantService.currentClinic().name }}
          </p>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
            Exercice 2026
          </span>
        </div>
      </div>

      <!-- Financial Health & Production Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <div class="text-xs text-neutral-400">Volume Facturé Global</div>
          <div class="text-xl font-bold font-mono text-neutral-900 dark:text-white mt-1">
            {{ i18n.formatCurrency(totalInvoiced()) }}
          </div>
          <div class="text-[11px] text-neutral-500 mt-1">Sur l'ensemble des devis clôturés</div>
        </div>

        <div class="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <div class="text-xs text-neutral-400">Total Encaissé Réel</div>
          <div class="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {{ i18n.formatCurrency(totalCollected()) }}
          </div>
          <div class="text-[11px] text-neutral-500 mt-1">Taux de recouvrement : 91.2%</div>
        </div>

        <div class="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <div class="text-xs text-neutral-400">Restes à Recouvrer (Impayés)</div>
          <div class="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {{ i18n.formatCurrency(totalOutstanding()) }}
          </div>
          <div class="text-[11px] text-neutral-500 mt-1">Sur 3 dossiers patients</div>
        </div>

        <div class="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <div class="text-xs text-neutral-400">Taux d'Acceptation des Devis</div>
          <div class="text-xl font-bold font-mono text-teal-600 dark:text-teal-400 mt-1">
            85.7%
          </div>
          <div class="text-[11px] text-neutral-500 mt-1">Excellent niveau d'adhésion aux soins</div>
        </div>
      </div>

      <!-- Doctor Production Breakdown -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
          <h2 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
            Production par Praticien (Actes & Honoraires)
          </h2>

          <div class="space-y-4">
            @for (doc of tenantService.clinicDoctors(); track doc.id) {
              <div class="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-2">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full" [style.backgroundColor]="doc.color"></span>
                    <span class="text-xs font-bold text-neutral-900 dark:text-white">{{ doc.name }}</span>
                  </div>
                  <span class="text-xs font-mono font-bold text-neutral-900 dark:text-white">
                    {{ doc.id === 'user-1' ? '28 450 MAD' : '19 500 MAD' }}
                  </span>
                </div>
                <div class="text-[11px] text-neutral-500">
                  {{ doc.specialty }} · {{ doc.id === 'user-1' ? '18 actes réalisés' : '14 actes réalisés' }}
                </div>
                <!-- Progress bar -->
                <div class="w-full bg-neutral-200 dark:bg-neutral-700 h-1.5 rounded-full overflow-hidden">
                  <div class="h-full rounded-full" [style.width]="doc.id === 'user-1' ? '65%' : '45%'" [style.backgroundColor]="doc.color"></div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Care Categories Distribution -->
        <div class="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
          <h2 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
            Répartition des Actes par Discipline
          </h2>

          <div class="space-y-3 text-xs">
            <div class="flex items-center justify-between">
              <span class="font-medium text-neutral-700 dark:text-neutral-300">Implantologie & Chirurgie</span>
              <span class="font-mono font-bold text-neutral-900 dark:text-white">38%</span>
            </div>
            <div class="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div class="bg-teal-600 h-full rounded-full" style="width: 38%"></div>
            </div>

            <div class="flex items-center justify-between pt-2">
              <span class="font-medium text-neutral-700 dark:text-neutral-300">Prothèse Fixe & Céramique</span>
              <span class="font-mono font-bold text-neutral-900 dark:text-white">29%</span>
            </div>
            <div class="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div class="bg-blue-500 h-full rounded-full" style="width: 29%"></div>
            </div>

            <div class="flex items-center justify-between pt-2">
              <span class="font-medium text-neutral-700 dark:text-neutral-300">Soins Conservateurs & Composites</span>
              <span class="font-mono font-bold text-neutral-900 dark:text-white">18%</span>
            </div>
            <div class="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div class="bg-amber-500 h-full rounded-full" style="width: 18%"></div>
            </div>

            <div class="flex items-center justify-between pt-2">
              <span class="font-medium text-neutral-700 dark:text-neutral-300">Parodontologie & Hygiène</span>
              <span class="font-mono font-bold text-neutral-900 dark:text-white">15%</span>
            </div>
            <div class="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div class="bg-purple-500 h-full rounded-full" style="width: 15%"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ReportsComponent {
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);
  readonly tenantService = inject(TenantService);

  readonly totalInvoiced = computed(() => {
    return this.dataService.invoices().reduce((acc, curr) => acc + curr.total, 0);
  });

  readonly totalCollected = computed(() => {
    return this.dataService.payments().reduce((acc, curr) => acc + curr.amount, 0);
  });

  readonly totalOutstanding = computed(() => {
    return this.dataService.patients().reduce((acc, curr) => acc + curr.balanceDue, 0);
  });
}
