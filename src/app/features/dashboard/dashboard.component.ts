import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { DentalDataService } from '../../core/services/dental-data.service';
import { TenantService } from '../../core/services/tenant.service';
import { NavigationTab } from '../../core/components/sidebar.component';
import { Appointment } from '../../core/models/appointment.models';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Welcome & Context Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 class="text-xl font-bold text-neutral-900 dark:text-white">
            Bonjour, {{ tenantService.currentUser().name }}
          </h1>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {{ tenantService.currentClinic().name }} · {{ i18n.formatDate(todayIso) }}
          </p>
        </div>

        <div class="flex items-center gap-2.5 flex-wrap">
          <button
            (click)="navigate('waiting-room')"
            class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-2 shadow-sm transition-colors">
            <mat-icon class="text-sm" style="font-size: 16px; width: 16px; height: 16px;">meeting_room</mat-icon>
            <span>Salle d'attente ({{ dataService.liveFlowWaiting().length }})</span>
          </button>

          <button
            (click)="navigate('agenda')"
            class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 flex items-center gap-2 transition-colors">
            <mat-icon class="text-sm" style="font-size: 16px; width: 16px; height: 16px;">add</mat-icon>
            <span>{{ i18n.dict().newAppointment }}</span>
          </button>
        </div>
      </div>

      <!-- KPI Metrics Grid -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Metric 1: Appointments Today -->
        <div class="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <div class="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs">
            <span>Rendez-vous aujourd'hui</span>
            <mat-icon class="text-teal-600 dark:text-teal-400 text-sm" style="font-size: 18px; width: 18px; height: 18px;">event</mat-icon>
          </div>
          <div class="text-2xl font-bold font-mono text-neutral-900 dark:text-white mt-2 tabular-nums">
            {{ dataService.todayAppointments().length }}
          </div>
          <div class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
            {{ completedTodayCount() }} terminés · {{ inTreatmentCount() }} au fauteuil
          </div>
        </div>

        <!-- Metric 2: Waiting Room -->
        <div class="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <div class="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs">
            <span>Patients en attente</span>
            <mat-icon class="text-amber-500 text-sm" style="font-size: 18px; width: 18px; height: 18px;">hourglass_top</mat-icon>
          </div>
          <div class="text-2xl font-bold font-mono text-neutral-900 dark:text-white mt-2 tabular-nums">
            {{ dataService.liveFlowWaiting().length }}
          </div>
          <div class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
            Temps moyen : ~12 min
          </div>
        </div>

        <!-- Metric 3: Active Patients -->
        <div class="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <div class="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs">
            <span>Dossiers Patients actifs</span>
            <mat-icon class="text-blue-500 text-sm" style="font-size: 18px; width: 18px; height: 18px;">folder_shared</mat-icon>
          </div>
          <div class="text-2xl font-bold font-mono text-neutral-900 dark:text-white mt-2 tabular-nums">
            {{ dataService.patients().length }}
          </div>
          <div class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
            100% numérisés avec odontogramme
          </div>
        </div>

        <!-- Metric 4: Month Production / Collection -->
        <div class="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <div class="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs">
            <span>Encaissements du mois</span>
            <mat-icon class="text-emerald-500 text-sm" style="font-size: 18px; width: 18px; height: 18px;">payments</mat-icon>
          </div>
          <div class="text-2xl font-bold font-mono text-neutral-900 dark:text-white mt-2 tabular-nums">
            {{ i18n.formatCurrency(totalCollectedMonth()) }}
          </div>
          <div class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
            Sur devis acceptés à 84.5%
          </div>
        </div>
      </div>

      <!-- Main Layout: Today's Schedule & Live Chair Flow -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Schedule Column (2 Cols) -->
        <div class="lg:col-span-2 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
            <div>
              <h2 class="text-sm font-bold text-neutral-900 dark:text-white">
                Rendez-vous du jour
              </h2>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">
                Ordre chronologique par praticien et fauteuil
              </p>
            </div>
            <button
              (click)="navigate('agenda')"
              class="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline">
              Ouvrir l'agenda complet →
            </button>
          </div>

          <div class="divide-y divide-neutral-100 dark:divide-neutral-800 mt-2">
            @for (apt of dataService.todayAppointments(); track apt.id) {
              <div class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 px-2 rounded-xl transition-colors">
                <div class="flex items-start gap-3">
                  <div class="text-center font-mono py-1 px-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 shrink-0">
                    <div class="text-xs font-bold text-neutral-900 dark:text-white">
                      {{ apt.startTime.split('T')[1].substring(0, 5) }}
                    </div>
                    <div class="text-[10px] text-neutral-500">
                      {{ apt.durationMinutes }}m
                    </div>
                  </div>

                  <div>
                    <div class="flex items-center gap-2">
                      <button
                        (click)="openPatient(apt.patientId)"
                        class="text-xs font-bold text-neutral-900 dark:text-white hover:text-teal-600 transition-colors text-left">
                        {{ apt.patientName }}
                      </button>
                      <span class="text-[10px] font-mono text-neutral-400">
                        {{ apt.patientNumber }}
                      </span>
                    </div>

                    <div class="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                      {{ apt.reason }}
                    </div>

                    <div class="flex items-center gap-3 text-[11px] text-neutral-400 mt-1">
                      <span>{{ apt.doctorName }}</span>
                      <span>·</span>
                      <span>{{ apt.chairName }}</span>
                    </div>
                  </div>
                </div>

                <!-- Status Action -->
                <div class="flex items-center gap-2 shrink-0">
                  @switch (apt.status) {
                    @case ('booked') {
                      <span class="text-xs font-medium text-neutral-500">Planifié</span>
                      <button
                        (click)="advanceStatus(apt, 'arrived')"
                        class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-teal-50 dark:hover:bg-teal-950 text-neutral-700 dark:text-neutral-300 hover:text-teal-700 transition-colors">
                        Arrivé
                      </button>
                    }
                    @case ('confirmed') {
                      <span class="text-xs font-medium text-blue-600 dark:text-blue-400">Confirmé</span>
                      <button
                        (click)="advanceStatus(apt, 'arrived')"
                        class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 transition-colors">
                        Arrivé
                      </button>
                    }
                    @case ('arrived') {
                      <span class="text-xs font-medium text-amber-600 dark:text-amber-400 font-semibold">En attente</span>
                      <button
                        (click)="advanceStatus(apt, 'in_treatment')"
                        class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors">
                        Faire entrer
                      </button>
                    }
                    @case ('in_treatment') {
                      <span class="text-xs font-medium text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1">
                        <span class="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                        Au fauteuil
                      </span>
                      <button
                        (click)="advanceStatus(apt, 'completed')"
                        class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 transition-colors">
                        Terminé
                      </button>
                    }
                    @case ('completed') {
                      <span class="text-xs font-medium text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <mat-icon class="text-xs" style="font-size: 14px; width: 14px; height: 14px;">check_circle</mat-icon>
                        Soins terminés
                      </span>
                    }
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Right Side: Chair Status & Quick Recall Alerts -->
        <div class="space-y-6">
          <!-- Operatories / Chairs status -->
          <div class="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <h2 class="text-sm font-bold text-neutral-900 dark:text-white mb-3">
              État des Fauteuils
            </h2>
            <div class="space-y-2.5">
              @for (chair of tenantService.currentClinicChairs(); track chair.id) {
                <div class="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <div>
                    <div class="text-xs font-bold text-neutral-900 dark:text-white">
                      {{ chair.name }}
                    </div>
                    <div class="text-[11px] text-neutral-500">
                      {{ chair.roomNumber }}
                    </div>
                  </div>

                  @let aptOnChair = getAppointmentOnChair(chair.id);
                  @if (aptOnChair) {
                    <div class="text-right">
                      <div class="text-xs font-semibold text-teal-600 dark:text-teal-400">
                        {{ aptOnChair.patientName }}
                      </div>
                      <div class="text-[10px] text-neutral-400">
                        {{ aptOnChair.doctorName }}
                      </div>
                    </div>
                  } @else {
                    <span class="text-[11px] font-medium text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
                      Disponible
                    </span>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Recall / Continuing Care Alerts -->
          <div class="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-bold text-neutral-900 dark:text-white">
                Rappels de contrôle dus
              </h2>
              <mat-icon class="text-teal-600 text-sm" style="font-size: 16px; width: 16px; height: 16px;">notification_important</mat-icon>
            </div>

            <div class="space-y-2.5">
              <div class="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-neutral-900 dark:text-white">Amina Tazi</span>
                  <span class="text-[10px] font-bold text-amber-700 dark:text-amber-400">À programmer</span>
                </div>
                <div class="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1">
                  Contrôle parodontal post-surfaçage (Échéance: 15 Oct 2026)
                </div>
              </div>

              <div class="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-neutral-900 dark:text-white">Karim Benjelloun</span>
                  <span class="text-[10px] font-medium text-neutral-500">1 Nov 2026</span>
                </div>
                <div class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                  Détartrage semestriel de routine
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent {
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);
  readonly tenantService = inject(TenantService);

  readonly tabChange = output<NavigationTab>();

  readonly todayIso = new Date().toISOString().split('T')[0];

  readonly completedTodayCount = computed(() => {
    return this.dataService.todayAppointments().filter((a) => a.status === 'completed').length;
  });

  readonly inTreatmentCount = computed(() => {
    return this.dataService.todayAppointments().filter((a) => a.status === 'in_treatment').length;
  });

  readonly totalCollectedMonth = computed(() => {
    return this.dataService.payments().reduce((acc, curr) => acc + curr.amount, 0);
  });

  getAppointmentOnChair(chairId: string): Appointment | undefined {
    return this.dataService.todayAppointments().find((a) => a.chairId === chairId && a.status === 'in_treatment');
  }

  advanceStatus(appointment: Appointment, nextStatus: Appointment['status']): void {
    this.dataService.updateAppointmentStatus(appointment.id, nextStatus);
  }

  openPatient(patientId: string): void {
    this.dataService.selectPatient(patientId);
    this.tabChange.emit('patients');
  }

  navigate(tab: NavigationTab): void {
    this.tabChange.emit(tab);
  }
}
