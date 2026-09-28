import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { DentalDataService } from '../../core/services/dental-data.service';
import { TenantService } from '../../core/services/tenant.service';
import { Appointment, AppointmentType } from '../../core/models/appointment.models';
import { AppointmentSchedulingService } from '../../core/services/appointment-scheduling.service';

@Component({
  selector: 'app-agenda',
  imports: [CommonModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Agenda Header & Toolbar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 class="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <mat-icon class="text-teal-600 dark:text-teal-400">calendar_month</mat-icon>
            <span>Agenda & Planning des Fauteuils</span>
          </h1>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {{ tenantService.currentClinic().name }} · {{ dataService.appointments().length }} consultations & soins programmés
          </p>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <!-- View Switcher Tabs -->
          <div class="flex items-center rounded-xl p-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            <button
              (click)="activeView.set('day')"
              [class.bg-white]="activeView() === 'day'"
              [class.dark:bg-neutral-700]="activeView() === 'day'"
              [class.shadow-sm]="activeView() === 'day'"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg text-neutral-700 dark:text-neutral-200 transition-colors">
              Jour
            </button>
            <button
              (click)="activeView.set('chairs')"
              [class.bg-white]="activeView() === 'chairs'"
              [class.dark:bg-neutral-700]="activeView() === 'chairs'"
              [class.shadow-sm]="activeView() === 'chairs'"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg text-neutral-700 dark:text-neutral-200 transition-colors">
              Par Fauteuil
            </button>
            <button
              (click)="activeView.set('list')"
              [class.bg-white]="activeView() === 'list'"
              [class.dark:bg-neutral-700]="activeView() === 'list'"
              [class.shadow-sm]="activeView() === 'list'"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg text-neutral-700 dark:text-neutral-200 transition-colors">
              Tous les RDV
            </button>
          </div>

          <button
            (click)="showNewModal.set(true)"
            class="px-4 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow-sm transition-colors">
            <mat-icon class="text-sm" style="font-size: 16px; width: 16px; height: 16px;">add</mat-icon>
            <span>Nouveau RDV</span>
          </button>
        </div>
      </div>

      <!-- VIEW 1: By Chairs / Operatories -->
      @if (activeView() === 'chairs') {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          @for (chair of tenantService.currentClinicChairs(); track chair.id) {
            <div class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
              <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
                <div>
                  <h3 class="text-xs font-bold text-neutral-900 dark:text-white">{{ chair.name }}</h3>
                  <div class="text-[11px] text-neutral-400">{{ chair.roomNumber }}</div>
                </div>
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              </div>

              <!-- List of appointments for this chair -->
              <div class="space-y-2.5">
                @for (apt of getAppointmentsForChair(chair.id); track apt.id) {
                  <div class="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-1.5">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold font-mono text-neutral-900 dark:text-white">
                        {{ apt.startTime.split('T')[1].substring(0, 5) }} - {{ apt.endTime.split('T')[1].substring(0, 5) }}
                      </span>
                      <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                        [class.bg-teal-100]="apt.status === 'in_treatment'"
                        [class.text-teal-700]="apt.status === 'in_treatment'"
                        [class.dark:bg-teal-950]="apt.status === 'in_treatment'"
                        [class.bg-amber-100]="apt.status === 'arrived'"
                        [class.text-amber-700]="apt.status === 'arrived'"
                        [class.bg-neutral-200]="apt.status === 'booked' || apt.status === 'confirmed'"
                        [class.text-neutral-700]="apt.status === 'booked' || apt.status === 'confirmed'"
                        [class.bg-emerald-100]="apt.status === 'completed'"
                        [class.text-emerald-700]="apt.status === 'completed'">
                        {{ getStatusLabel(apt.status) }}
                      </span>
                    </div>

                    <div class="text-xs font-semibold text-neutral-900 dark:text-white">
                      {{ apt.patientName }}
                    </div>

                    <div class="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {{ apt.reason }} · {{ apt.doctorName }}
                    </div>
                  </div>
                } @empty {
                  <div class="text-center py-8 text-xs text-neutral-400 italic">
                    Aucun rendez-vous sur ce fauteuil aujourd'hui
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- VIEW 2: Day Timeline View -->
      @if (activeView() === 'day' || activeView() === 'list') {
        <div class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  <th class="py-3 px-3">Horaire</th>
                  <th class="py-3 px-3">Patient</th>
                  <th class="py-3 px-3">Type & Motif</th>
                  <th class="py-3 px-3">Praticien</th>
                  <th class="py-3 px-3">Fauteuil</th>
                  <th class="py-3 px-3">Statut</th>
                  <th class="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800">
                @for (apt of dataService.appointments(); track apt.id) {
                  <tr class="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td class="py-3 px-3 font-mono font-semibold text-neutral-900 dark:text-white whitespace-nowrap">
                      {{ apt.startTime.split('T')[0] }} · {{ apt.startTime.split('T')[1].substring(0, 5) }} ({{ apt.durationMinutes }}m)
                    </td>
                    <td class="py-3 px-3">
                      <div class="font-semibold text-neutral-900 dark:text-white">{{ apt.patientName }}</div>
                      <div class="text-[11px] text-neutral-400">{{ apt.patientPhone }}</div>
                    </td>
                    <td class="py-3 px-3">
                      <div class="font-medium text-neutral-800 dark:text-neutral-200">{{ apt.reason }}</div>
                      <div class="text-[11px] text-neutral-400 capitalize">{{ apt.appointmentType }}</div>
                    </td>
                    <td class="py-3 px-3">
                      <span class="text-neutral-700 dark:text-neutral-300 font-medium">{{ apt.doctorName }}</span>
                    </td>
                    <td class="py-3 px-3 text-neutral-500">
                      {{ apt.chairName }}
                    </td>
                    <td class="py-3 px-3">
                      <span class="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-md"
                        [class.bg-teal-100]="apt.status === 'in_treatment'"
                        [class.text-teal-800]="apt.status === 'in_treatment'"
                        [class.dark:bg-teal-950]="apt.status === 'in_treatment'"
                        [class.dark:text-teal-300]="apt.status === 'in_treatment'"
                        [class.bg-amber-100]="apt.status === 'arrived'"
                        [class.text-amber-800]="apt.status === 'arrived'"
                        [class.bg-blue-100]="apt.status === 'confirmed'"
                        [class.text-blue-800]="apt.status === 'confirmed'"
                        [class.bg-neutral-100]="apt.status === 'booked'"
                        [class.text-neutral-700]="apt.status === 'booked'"
                        [class.bg-emerald-100]="apt.status === 'completed'"
                        [class.text-emerald-800]="apt.status === 'completed'">
                        {{ getStatusLabel(apt.status) }}
                      </span>
                    </td>
                    <td class="py-3 px-3 text-right">
                      <select
                        [ngModel]="apt.status"
                        (ngModelChange)="dataService.updateAppointmentStatus(apt.id, $event)"
                        class="text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1 text-neutral-700 dark:text-neutral-300 focus:outline-none">
                        <option value="booked">Planifié</option>
                        <option value="confirmed">Confirmé</option>
                        <option value="arrived">Arrivé</option>
                        <option value="in_treatment">Au fauteuil</option>
                        <option value="completed">Terminé</option>
                        <option value="cancelled">Annulé</option>
                        <option value="no_show">Absent</option>
                      </select>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Modal: Nouveau Rendez-vous -->
      @if (showNewModal()) {
        <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 class="text-base font-bold text-neutral-900 dark:text-white">Planifier un Rendez-vous</h3>
              <button (click)="showNewModal.set(false)" class="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
                <mat-icon class="text-sm">close</mat-icon>
              </button>
            </div>

            <div class="space-y-3 text-xs">
              <!-- Select Patient -->
              <div>
                <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Patient</span>
                <select [(ngModel)]="newAptPatientId" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white">
                  @for (p of dataService.patients(); track p.id) {
                    <option [value]="p.id">{{ p.firstName }} {{ p.lastName }} ({{ p.patientNumber }} - {{ p.phone }})</option>
                  }
                </select>
              </div>

              <!-- Select Doctor -->
              <div>
                <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Praticien</span>
                <select [(ngModel)]="newAptDoctorId" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white">
                  @for (doc of tenantService.clinicDoctors(); track doc.id) {
                    <option [value]="doc.id">{{ doc.name }} ({{ doc.specialty || 'Dentiste' }})</option>
                  }
                </select>
              </div>

              <!-- Select Chair -->
              <div>
                <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Fauteuil</span>
                <select [(ngModel)]="newAptChairId" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white">
                  @for (chair of tenantService.currentClinicChairs(); track chair.id) {
                    <option [value]="chair.id">{{ chair.name }} ({{ chair.roomNumber }})</option>
                  }
                </select>
              </div>

              <!-- Appointment Type & Duration -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Type d'acte</span>
                  <select [(ngModel)]="newAptType" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white">
                    <option value="consultation">Consultation</option>
                    <option value="soin">Soins conservateurs</option>
                    <option value="detartrage">Détartrage</option>
                    <option value="endodontie">Endodontie</option>
                    <option value="prothese">Prothèse</option>
                    <option value="chirurgie">Chirurgie</option>
                    <option value="urgence">Urgence</option>
                    <option value="controle">Contrôle</option>
                  </select>
                </div>
                <div>
                  <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Durée (minutes)</span>
                  <select [(ngModel)]="newAptDuration" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white">
                    <option [value]="15">15 min</option>
                    <option [value]="30">30 min</option>
                    <option [value]="45">45 min</option>
                    <option [value]="60">60 min</option>
                    <option [value]="90">90 min</option>
                  </select>
                </div>
              </div>

              <!-- Time -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Date</span>
                  <input type="date" [(ngModel)]="newAptDate" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
                </div>
                <div>
                  <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Heure de début</span>
                  <input type="time" [(ngModel)]="newAptTime" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
                </div>
              </div>

              <!-- Reason / Motif -->
              <div>
                <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Motif de consultation</span>
                <input type="text" [(ngModel)]="newAptReason" placeholder="Ex: Composite 16, bilan annuel, pose couronne..." class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
              </div>
            </div>

            @if (scheduleError()) {
              <div class="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                {{ scheduleError() }}
              </div>
            }

            <div class="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <button (click)="showNewModal.set(false)" class="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                Annuler
              </button>
              <button (click)="saveAppointment()" class="px-4 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm">
                Enregistrer le RDV
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})

export class AgendaComponent {
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);
  readonly tenantService = inject(TenantService);
  readonly scheduling = inject(AppointmentSchedulingService);
  readonly scheduleError = signal<string | null>(null);

  readonly activeView = signal<'day' | 'chairs' | 'list'>('chairs');
  readonly showNewModal = signal<boolean>(false);

  newAptPatientId = 'pat-1';
  newAptDoctorId = 'user-1';
  newAptChairId = 'chair-1';
  newAptType: AppointmentType = 'consultation';
  newAptDuration = 30;
  newAptDate = new Date().toISOString().split('T')[0];
  newAptTime = '14:00';
  newAptReason = '';

  getAppointmentsForChair(chairId: string): Appointment[] {
    return this.dataService.todayAppointments().filter((a) => a.chairId === chairId);
  }

  getStatusLabel(status: Appointment['status']): string {
    switch (status) {
      case 'booked': return 'Planifié';
      case 'confirmed': return 'Confirmé';
      case 'arrived': return 'En attente';
      case 'in_treatment': return 'Au fauteuil';
      case 'completed': return 'Terminé';
      case 'cancelled': return 'Annulé';
      case 'no_show': return 'Non venu';
    }
  }

  saveAppointment(): void {
    this.scheduleError.set(null);
    const patient = this.dataService.patients().find((p) => p.id === this.newAptPatientId);
    const doctor = this.tenantService.users().find((u) => u.id === this.newAptDoctorId);
    const chair = this.tenantService.currentClinicChairs().find((c) => c.id === this.newAptChairId);

    if (!patient || !doctor || !chair) return;

    const startIso = `${this.newAptDate}T${this.newAptTime}:00`;
    const endMinutes = parseInt(this.newAptTime.split(':')[0]) * 60 + parseInt(this.newAptTime.split(':')[1]) + this.newAptDuration;
    const endHour = Math.floor(endMinutes / 60);
    const endMin = endMinutes % 60;
    const endIso = `${this.newAptDate}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;

    const clinicAppointments = this.dataService.appointments().filter(
      (appointment) => appointment.clinicId === this.tenantService.currentClinicId(),
    );
    if (!this.scheduling.isAvailable(clinicAppointments, startIso, endIso, doctor.id, chair.id)) {
      this.scheduleError.set('Ce praticien et ce fauteuil sont déjà occupés sur ce créneau.');
      return;
    }

    this.dataService.addAppointment({
      organizationId: this.tenantService.currentOrganizationId(),
      clinicId: this.tenantService.currentClinicId(),
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientPhone: patient.phone,
      patientNumber: patient.patientNumber,
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorColor: doctor.color,
      chairId: chair.id,
      chairName: chair.name,
      appointmentType: this.newAptType,
      startTime: startIso,
      endTime: endIso,
      durationMinutes: this.newAptDuration,
      status: 'confirmed',
      reason: this.newAptReason || 'Consultation programmée',
    });

    this.showNewModal.set(false);
  }
}
