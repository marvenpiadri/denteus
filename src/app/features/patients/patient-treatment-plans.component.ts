import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { DentalDataService } from '../../core/services/dental-data.service';
import { TenantService } from '../../core/services/tenant.service';
import { OdontogramTreatmentPlanService } from '../../core/services/odontogram-treatment-plan.service';
import { OdontogramPersistenceService } from '../../core/services/odontogram-persistence.service';

@Component({
  selector: 'app-patient-treatment-plans',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
          Plans de Traitement & Devis
        </h2>
      </div>

      @if (odontogramPlanCandidates().length > 0) {
        <div class="bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 rounded-2xl p-4 space-y-3">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-sm font-bold text-teal-900 dark:text-teal-100">Plan détecté depuis l'odontogramme</h3>
              <p class="text-xs text-teal-700 dark:text-teal-300 mt-1">
                Les modifications en mode Plan sont prêtes à devenir des actes de soins Denteus.
              </p>
            </div>
            <button
              type="button"
              (click)="createTreatmentPlanFromOdontogram()"
              class="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white">
              Créer le plan
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            @for (candidate of odontogramPlanCandidates(); track candidate.toothNumber + '-' + candidate.axis) {
              <div class="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/70 dark:bg-neutral-900/60 border border-teal-100 dark:border-teal-900/50">
                <span class="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Dent {{ candidate.toothNumber }} · {{ candidate.procedureName }}
                </span>
                <span class="text-xs font-mono text-neutral-500">{{ i18n.formatCurrency(candidate.suggestedFee) }}</span>
              </div>
            }
          </div>
        </div>
      }

      <div class="space-y-4">
        @for (plan of dataService.activePatientTreatmentPlans(); track plan.id) {
          <article class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h3 class="text-base font-bold text-neutral-900 dark:text-white">{{ plan.title }}</h3>
                <div class="text-xs text-neutral-400 mt-0.5">
                  Créé le {{ i18n.formatDate(plan.createdAt) }} par {{ plan.doctorName }}
                </div>
              </div>

              <div class="flex items-center gap-3">
                <span class="text-xs font-bold px-2.5 py-1 rounded-lg"
                  [class.bg-emerald-100]="plan.status === 'accepted'"
                  [class.text-emerald-800]="plan.status === 'accepted'"
                  [class.bg-blue-100]="plan.status === 'planned'"
                  [class.text-blue-800]="plan.status === 'planned'">
                  {{ plan.status === 'accepted' ? 'Devis Accepté' : 'Plan Proposé' }}
                </span>

                <span class="text-base font-mono font-bold text-teal-600 dark:text-teal-400">
                  {{ i18n.formatCurrency(plan.total) }}
                </span>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="text-[11px] font-semibold text-neutral-400 border-b border-neutral-100 dark:border-neutral-800">
                    <th class="py-2">Dent</th>
                    <th class="py-2">Acte / Procédure</th>
                    <th class="py-2">Catégorie</th>
                    <th class="py-2 text-right">Tarif</th>
                    <th class="py-2 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800">
                  @for (item of plan.items; track item.id) {
                    <tr>
                      <td class="py-2.5 font-bold font-mono text-neutral-800 dark:text-neutral-200">
                        {{ item.toothNumber ? 'Dent ' + item.toothNumber : 'Global' }}
                      </td>
                      <td class="py-2.5 font-medium text-neutral-900 dark:text-white">{{ item.procedureName }}</td>
                      <td class="py-2.5 text-neutral-400 capitalize">{{ item.category.replace('_', ' ') }}</td>
                      <td class="py-2.5 text-right font-mono font-semibold text-neutral-900 dark:text-white">
                        {{ i18n.formatCurrency(item.fee) }}
                      </td>
                      <td class="py-2.5 text-right">
                        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                          {{ item.status === 'completed' ? 'Réalisé' : item.status === 'scheduled' ? 'Programmé' : 'En attente' }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (plan.notes) {
              <div class="text-xs text-neutral-500 italic p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl">
                Observations : {{ plan.notes }}
              </div>
            }
          </article>
        } @empty {
          <div class="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-400 italic">
            Aucun plan de traitement enregistré pour ce patient
          </div>
        }
      </div>
    </div>
  `,
})
export class PatientTreatmentPlansComponent {
  readonly patientId = input.required<string>();
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);
  readonly tenantService = inject(TenantService);
  readonly odontogramTreatmentPlan = inject(OdontogramTreatmentPlanService);
  readonly odontogramPersistence = inject(OdontogramPersistenceService);

  readonly odontogramPlanCandidates = computed(() => {
    if (this.odontogramPersistence.attachedPatientId() !== this.patientId()) return [];
    return this.odontogramTreatmentPlan.getCandidates(
      this.odontogramPersistence.planChanges(),
      this.dataService.procedures(),
    );
  });

  createTreatmentPlanFromOdontogram(): void {
    const candidates = this.odontogramPlanCandidates();
    if (!candidates.length) return;

    const planId = `pending-${Date.now()}`;
    const items = this.odontogramTreatmentPlan.buildItems(planId, candidates);
    const subtotal = items.reduce((sum, item) => sum + item.fee, 0);

    this.dataService.addTreatmentPlan({
      patientId: this.patientId(),
      clinicId: this.tenantService.currentClinicId(),
      doctorId: this.tenantService.currentUserId(),
      doctorName: this.tenantService.currentUser().name,
      title: 'Plan issu de l’odontogramme',
      status: 'planned',
      items,
      subtotal,
      discountPercent: 0,
      total: subtotal,
      notes: 'Généré à partir des différences entre le statut clinique et le plan odontogramme.',
    });
  }
}
