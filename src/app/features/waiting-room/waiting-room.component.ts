import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { DentalDataService } from '../../core/services/dental-data.service';
import { TenantService } from '../../core/services/tenant.service';
import { NavigationTab } from '../../core/components/sidebar.component';

@Component({
  selector: 'app-waiting-room',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 class="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2.5">
            <mat-icon class="text-teal-600 dark:text-teal-400">meeting_room</mat-icon>
            <span>Flux Clinique & Salle d'Attente</span>
          </h1>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Pilotage en direct des arrivées, de l'occupation des fauteuils et des sorties de soins
          </p>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            {{ tenantService.currentClinic().name }}
          </span>
        </div>
      </div>

      <!-- Live Kanban Board: 4 Columns -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        <!-- Col 1: Attendus / Prochains RDV -->
        <div class="bg-neutral-50 dark:bg-neutral-900/60 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col gap-3 min-h-[500px]">
          <div class="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-700">
            <span class="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              1. Attendus aujourd'hui ({{ dataService.liveFlowUpcoming().length }})
            </span>
            <mat-icon class="text-neutral-400 text-xs" style="font-size: 16px; width: 16px; height: 16px;">schedule</mat-icon>
          </div>

          @for (apt of dataService.liveFlowUpcoming(); track apt.id) {
            <div class="p-3 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-neutral-900 dark:text-white">
                  {{ apt.startTime.split('T')[1].substring(0, 5) }}
                </span>
                <span class="text-[10px] font-mono text-neutral-400">
                  {{ apt.durationMinutes }}m
                </span>
              </div>

              <div>
                <button
                  (click)="openPatient(apt.patientId)"
                  class="text-xs font-semibold text-neutral-900 dark:text-white hover:text-teal-600 text-left">
                  {{ apt.patientName }}
                </button>
                <div class="text-[11px] text-neutral-500 mt-0.5">
                  {{ apt.reason }}
                </div>
              </div>

              <div class="text-[10px] text-neutral-400">
                {{ apt.doctorName }} · {{ apt.chairName }}
              </div>

              <div class="pt-2 border-t border-neutral-100 dark:border-neutral-700 flex justify-end">
                <button
                  (click)="dataService.updateAppointmentStatus(apt.id, 'arrived')"
                  class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 transition-colors flex items-center gap-1">
                  <mat-icon class="text-xs" style="font-size: 14px; width: 14px; height: 14px;">check</mat-icon>
                  <span>Enregistrer l'arrivée</span>
                </button>
              </div>
            </div>
          } @empty {
            <div class="text-center py-10 text-xs text-neutral-400 italic">
              Aucun patient supplémentaire attendu
            </div>
          }
        </div>

        <!-- Col 2: En Salle d'Attente -->
        <div class="bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 flex flex-col gap-3 min-h-[500px]">
          <div class="flex items-center justify-between pb-2 border-b border-amber-200 dark:border-amber-900/60">
            <span class="text-xs font-bold text-amber-800 dark:text-amber-300">
              2. En salle d'attente ({{ dataService.liveFlowWaiting().length }})
            </span>
            <mat-icon class="text-amber-600 text-xs" style="font-size: 16px; width: 16px; height: 16px;">hourglass_top</mat-icon>
          </div>

          @for (apt of dataService.liveFlowWaiting(); track apt.id) {
            <div class="p-3 bg-white dark:bg-neutral-800 rounded-xl border border-amber-200 dark:border-amber-900/80 shadow-sm space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Arrivé
                </span>
                <span class="text-[10px] font-mono text-neutral-400">
                  RDV prévu : {{ apt.startTime.split('T')[1].substring(0, 5) }}
                </span>
              </div>

              <div>
                <button
                  (click)="openPatient(apt.patientId)"
                  class="text-xs font-semibold text-neutral-900 dark:text-white hover:text-teal-600 text-left">
                  {{ apt.patientName }}
                </button>
                <div class="text-[11px] text-neutral-500 mt-0.5">
                  {{ apt.reason }}
                </div>
              </div>

              <div class="text-[10px] text-neutral-400">
                Avec : {{ apt.doctorName }}
              </div>

              <div class="pt-2 border-t border-neutral-100 dark:border-neutral-700 flex justify-end">
                <button
                  (click)="dataService.updateAppointmentStatus(apt.id, 'in_treatment')"
                  class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors flex items-center gap-1 shadow-sm">
                  <mat-icon class="text-xs" style="font-size: 14px; width: 14px; height: 14px;">arrow_forward</mat-icon>
                  <span>Faire entrer au fauteuil</span>
                </button>
              </div>
            </div>
          } @empty {
            <div class="text-center py-10 text-xs text-neutral-400 italic">
              Salle d'attente vide
            </div>
          }
        </div>

        <!-- Col 3: Au Fauteuil / En cours de soin -->
        <div class="bg-teal-50/50 dark:bg-teal-950/20 p-4 rounded-2xl border border-teal-200 dark:border-teal-900/40 flex flex-col gap-3 min-h-[500px]">
          <div class="flex items-center justify-between pb-2 border-b border-teal-200 dark:border-teal-900/60">
            <span class="text-xs font-bold text-teal-800 dark:text-teal-300">
              3. Au Fauteuil ({{ dataService.liveFlowInTreatment().length }})
            </span>
            <mat-icon class="text-teal-600 text-xs" style="font-size: 16px; width: 16px; height: 16px;">airline_seat_recline_extra</mat-icon>
          </div>

          @for (apt of dataService.liveFlowInTreatment(); track apt.id) {
            <div class="p-3 bg-white dark:bg-neutral-800 rounded-xl border border-teal-300 dark:border-teal-800 shadow-sm space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                  <span class="w-2 h-2 rounded-full bg-teal-500 animate-ping"></span>
                  En soin
                </span>
                <span class="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 rounded">
                  {{ apt.chairName }}
                </span>
              </div>

              <div>
                <button
                  (click)="openPatient(apt.patientId)"
                  class="text-xs font-bold text-neutral-900 dark:text-white hover:text-teal-600 text-left">
                  {{ apt.patientName }}
                </button>
                <div class="text-[11px] text-neutral-500 mt-0.5">
                  {{ apt.reason }}
                </div>
              </div>

              <div class="text-[10px] text-neutral-400">
                Praticien : {{ apt.doctorName }}
              </div>

              <div class="pt-2 border-t border-neutral-100 dark:border-neutral-700 flex justify-end">
                <button
                  (click)="dataService.updateAppointmentStatus(apt.id, 'completed')"
                  class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 transition-colors flex items-center gap-1">
                  <mat-icon class="text-xs" style="font-size: 14px; width: 14px; height: 14px;">check_circle</mat-icon>
                  <span>Soin terminé</span>
                </button>
              </div>
            </div>
          } @empty {
            <div class="text-center py-10 text-xs text-neutral-400 italic">
              Aucun patient actuellement au fauteuil
            </div>
          }
        </div>

        <!-- Col 4: Soins Terminés / Facturation -->
        <div class="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 flex flex-col gap-3 min-h-[500px]">
          <div class="flex items-center justify-between pb-2 border-b border-emerald-200 dark:border-emerald-900/60">
            <span class="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              4. Terminés aujourd'hui ({{ dataService.liveFlowCompleted().length }})
            </span>
            <mat-icon class="text-emerald-600 text-xs" style="font-size: 16px; width: 16px; height: 16px;">task_alt</mat-icon>
          </div>

          @for (apt of dataService.liveFlowCompleted(); track apt.id) {
            <div class="p-3 bg-white dark:bg-neutral-800 rounded-xl border border-emerald-200 dark:border-neutral-700 shadow-sm space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {{ apt.patientName }}
                </span>
                <span class="text-[10px] text-neutral-400">
                  {{ apt.startTime.split('T')[1].substring(0, 5) }}
                </span>
              </div>

              <div class="text-[11px] text-neutral-500">
                {{ apt.reason }} · {{ apt.doctorName }}
              </div>

              <div class="pt-2 border-t border-neutral-100 dark:border-neutral-700 flex justify-end">
                <button
                  (click)="openPatientBilling(apt.patientId)"
                  class="px-2 py-0.5 text-[11px] font-semibold rounded bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 text-neutral-700 dark:text-neutral-300 transition-colors">
                  Voir facturation
                </button>
              </div>
            </div>
          } @empty {
            <div class="text-center py-10 text-xs text-neutral-400 italic">
              Aucun soin clôturé pour le moment
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class WaitingRoomComponent {
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);
  readonly tenantService = inject(TenantService);

  readonly tabChange = output<NavigationTab>();

  openPatient(patientId: string): void {
    this.dataService.selectPatient(patientId);
    this.tabChange.emit('patients');
  }

  openPatientBilling(patientId: string): void {
    this.dataService.selectPatient(patientId);
    this.tabChange.emit('patients');
  }
}
