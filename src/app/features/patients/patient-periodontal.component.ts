import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { DentalDataService } from '../../core/services/dental-data.service';
import { TenantService } from '../../core/services/tenant.service';
import { PeriodontalDiagnosisCategory, PeriodontalExamination, ToothPerioMeasurement } from '../../core/models/periodontal.models';

@Component({
  selector: 'app-patient-periodontal',
  imports: [CommonModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
@if (activeTab() === 'periodontal') {
        <div class="space-y-6">
          <!-- Periodontal Header & Classification Summary -->
          @let latestExam = dataService.activePatientPerioExams()[0];
          @if (latestExam) {
            <div class="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
                <div>
                  <h3 class="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <mat-icon class="text-rose-600">water_drop</mat-icon>
                    <span>Classification Parodontale 2017 : {{ latestExam.summary.diagnosis }}</span>
                  </h3>
                  <p class="text-xs text-neutral-500">
                    Dernier examen réalisé le {{ i18n.formatDate(latestExam.examDate) }} par {{ latestExam.doctorName }}
                  </p>
                </div>

                <button
                  (click)="showNewPerioModal.set(true)"
                  class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors flex items-center gap-1.5 self-start">
                  <mat-icon class="text-xs">add</mat-icon>
                  <span>Nouvel examen parodontal</span>
                </button>
              </div>

              <!-- Periodontal Indices Grid -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                  <div class="text-[11px] text-neutral-400">Saignement au Sondage (% BOP)</div>
                  <div class="text-xl font-bold font-mono mt-1"
                    [class.text-rose-600]="latestExam.summary.bopPercentage >= 20"
                    [class.text-emerald-600]="latestExam.summary.bopPercentage < 10">
                    {{ latestExam.summary.bopPercentage }}%
                  </div>
                  <div class="text-[10px] text-neutral-400 mt-0.5">Seuil de santé : < 10%</div>
                </div>

                <div class="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                  <div class="text-[11px] text-neutral-400">Poches profondes (≥ 5mm)</div>
                  <div class="text-xl font-bold font-mono text-neutral-900 dark:text-white mt-1">
                    {{ latestExam.summary.deepPocketsCount }} sites
                  </div>
                  <div class="text-[10px] text-neutral-400 mt-0.5">À débrider / surfacer</div>
                </div>

                <div class="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                  <div class="text-[11px] text-neutral-400">Perte d'attache max (CAL)</div>
                  <div class="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
                    {{ latestExam.summary.worstCal }} mm
                  </div>
                  <div class="text-[10px] text-neutral-400 mt-0.5">Sur dent {{ latestExam.summary.worstCalTooth }}</div>
                </div>

                <div class="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                  <div class="text-[11px] text-neutral-400">Indice de Plaque (O'Leary)</div>
                  <div class="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                    {{ latestExam.summary.plaqueIndexPercentage }}%
                  </div>
                  <div class="text-[10px] text-neutral-400 mt-0.5">Cible hygiène : < 20%</div>
                </div>
              </div>
            </div>

            <!-- Probing Depths Chart per tooth -->
            <div class="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
              <h3 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                Relevé Détaillé des Poches par Dent (6 sites de sondage)
              </h3>

              <div class="overflow-x-auto">
                <table class="w-full text-center text-xs font-mono">
                  <thead>
                    <tr class="border-b border-neutral-200 dark:border-neutral-800 text-[10px] text-neutral-400">
                      <th class="text-left py-2 px-2">Dent</th>
                      <th>MB</th>
                      <th>B</th>
                      <th>DB</th>
                      <th>ML</th>
                      <th>L</th>
                      <th>DL</th>
                      <th>Mobilité</th>
                      <th>Saignement</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800">
                    @for (toothEntry of getExamTeethEntries(latestExam); track toothEntry.toothNumber) {
                      <tr>
                        <td class="text-left py-2 px-2 font-bold font-sans text-neutral-900 dark:text-white">
                          Dent {{ toothEntry.toothNumber }}
                        </td>
                        <td [class.text-rose-600]="toothEntry.sites.MB.pd >= 5" [class.font-bold]="toothEntry.sites.MB.pd >= 5">
                          {{ toothEntry.sites.MB.pd }}mm
                        </td>
                        <td [class.text-rose-600]="toothEntry.sites.B.pd >= 5" [class.font-bold]="toothEntry.sites.B.pd >= 5">
                          {{ toothEntry.sites.B.pd }}mm
                        </td>
                        <td [class.text-rose-600]="toothEntry.sites.DB.pd >= 5" [class.font-bold]="toothEntry.sites.DB.pd >= 5">
                          {{ toothEntry.sites.DB.pd }}mm
                        </td>
                        <td [class.text-rose-600]="toothEntry.sites.ML.pd >= 5" [class.font-bold]="toothEntry.sites.ML.pd >= 5">
                          {{ toothEntry.sites.ML.pd }}mm
                        </td>
                        <td [class.text-rose-600]="toothEntry.sites.L.pd >= 5" [class.font-bold]="toothEntry.sites.L.pd >= 5">
                          {{ toothEntry.sites.L.pd }}mm
                        </td>
                        <td [class.text-rose-600]="toothEntry.sites.DL.pd >= 5" [class.font-bold]="toothEntry.sites.DL.pd >= 5">
                          {{ toothEntry.sites.DL.pd }}mm
                        </td>
                        <td>
                          {{ toothEntry.mobility || 0 }}
                        </td>
                        <td>
                          @if (toothEntry.sites.MB.bop || toothEntry.sites.DB.bop || toothEntry.sites.DL.bop) {
                            <span class="text-rose-600 font-bold">BOP+</span>
                          } @else {
                            <span class="text-neutral-400">-</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          } @else {
            <div class="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-center space-y-3">
              <mat-icon class="text-neutral-400" style="font-size: 36px; width: 36px; height: 36px;">water_drop</mat-icon>
              <div class="text-xs font-bold text-neutral-800 dark:text-neutral-200">Aucun bilan parodontal enregistré pour ce patient</div>
              <button
                (click)="showNewPerioModal.set(true)"
                class="px-4 py-2 text-xs font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors">
                Créer le premier bilan parodontal
              </button>
            </div>
          }
        </div>
      }
  `,
})
export class PatientPeriodontalComponent {
  readonly patientId = input.required<string>();
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);
  readonly tenantService = inject(TenantService);

  readonly showNewPerioModal = signal(false);

  newPerioBop = 15;
  newPerioCal = 5;
  newPerioDx = 'Parodontite Stade II';

  getExamTeethEntries(exam: PeriodontalExamination): ToothPerioMeasurement[] {
    return Object.values(exam.measurements);
  }

  saveNewPerioExam(): void {
    this.dataService.addPeriodontalExam({
      patientId: this.patientId(),
      clinicId: this.tenantService.currentClinicId(),
      doctorId: this.tenantService.currentUserId(),
      doctorName: this.tenantService.currentUser().name,
      examDate: new Date().toISOString().split('T')[0],
      summary: {
        totalSitesCharted: 96,
        bleedingSitesCount: Math.round((this.newPerioBop / 100) * 96),
        bopPercentage: this.newPerioBop,
        deepPocketsCount: 4,
        worstCal: this.newPerioCal,
        worstCalTooth: 16,
        plaqueIndexPercentage: 20,
        diagnosis: this.newPerioDx as PeriodontalDiagnosisCategory,
      },
      measurements: {
        16: {
          toothNumber: 16,
          sites: {
            MB: { pd: 4, gm: 1, cal: 5, bop: true, suppuration: false },
            B: { pd: 3, gm: 0, cal: 3, bop: false, suppuration: false },
            DB: { pd: 5, gm: 0, cal: 5, bop: true, suppuration: false },
            ML: { pd: 3, gm: 0, cal: 3, bop: false, suppuration: false },
            L: { pd: 2, gm: 0, cal: 2, bop: false, suppuration: false },
            DL: { pd: 4, gm: 0, cal: 4, bop: false, suppuration: false },
          },
        },
      },
    });
    this.showNewPerioModal.set(false);
  }
}
