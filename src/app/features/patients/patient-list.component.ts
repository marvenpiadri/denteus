import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { DentalDataService } from '../../core/services/dental-data.service';
import { TenantService } from '../../core/services/tenant.service';

@Component({
  selector: 'app-patient-list',
  imports: [CommonModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 class="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <mat-icon class="text-teal-600 dark:text-teal-400">badge</mat-icon>
            <span>Dossiers Patients</span>
          </h1>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {{ dataService.patients().length }} patients enregistrés dans l'organisation
          </p>
        </div>

        <button
          (click)="showNewPatientModal.set(true)"
          class="px-4 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow-sm transition-colors self-start sm:self-auto">
          <mat-icon class="text-sm" style="font-size: 16px; width: 16px; height: 16px;">person_add</mat-icon>
          <span>Nouveau patient</span>
        </button>
      </div>

      <!-- Search & Filter Controls -->
      <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div class="relative flex-1 max-w-md">
          <mat-icon class="absolute left-3 top-2.5 text-neutral-400 text-sm" style="font-size: 18px; width: 18px; height: 18px;">search</mat-icon>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Rechercher par nom, téléphone, CIN, N° dossier..."
            class="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-teal-500" />
        </div>

        <!-- Filter Segmented Tabs -->
        <div class="flex items-center rounded-xl p-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 overflow-x-auto">
          <button
            (click)="filterType.set('all')"
            [class.bg-white]="filterType() === 'all'"
            [class.dark:bg-neutral-700]="filterType() === 'all'"
            [class.shadow-sm]="filterType() === 'all'"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg text-neutral-700 dark:text-neutral-200 whitespace-nowrap transition-colors">
            Tous ({{ dataService.patients().length }})
          </button>
          <button
            (click)="filterType.set('alerts')"
            [class.bg-white]="filterType() === 'alerts'"
            [class.dark:bg-neutral-700]="filterType() === 'alerts'"
            [class.shadow-sm]="filterType() === 'alerts'"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg text-neutral-700 dark:text-neutral-200 whitespace-nowrap transition-colors">
            Alertes médicales
          </button>
          <button
            (click)="filterType.set('balance')"
            [class.bg-white]="filterType() === 'balance'"
            [class.dark:bg-neutral-700]="filterType() === 'balance'"
            [class.shadow-sm]="filterType() === 'balance'"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg text-neutral-700 dark:text-neutral-200 whitespace-nowrap transition-colors">
            Soldes impayés
          </button>
        </div>
      </div>

      <!-- Patients Grid / Table -->
      <div class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                <th class="py-3 px-4">Patient & N° Dossier</th>
                <th class="py-3 px-4">Contact & Ville</th>
                <th class="py-3 px-4">Alertes Médicales / Allergies</th>
                <th class="py-3 px-4">Prochain Rappel</th>
                <th class="py-3 px-4 text-right">Solde Dû</th>
                <th class="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800">
              @for (patient of filteredPatients(); track patient.id) {
                <tr class="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                  <td class="py-3 px-4">
                    <button
                      (click)="onSelectPatient(patient.id)"
                      class="text-left group">
                      <div class="font-bold text-neutral-900 dark:text-white group-hover:text-teal-600 transition-colors">
                        {{ patient.firstName }} {{ patient.lastName }}
                      </div>
                      <div class="text-[11px] text-neutral-400 font-mono">
                        {{ patient.patientNumber }} · CIN: {{ patient.cin || 'N/A' }} · {{ patient.gender === 'F' ? 'Femme' : 'Homme' }}
                      </div>
                    </button>
                  </td>

                  <td class="py-3 px-4">
                    <div class="text-neutral-700 dark:text-neutral-300 font-medium">{{ patient.phone }}</div>
                    <div class="text-[11px] text-neutral-400">{{ patient.city || 'Casablanca' }}</div>
                  </td>

                  <td class="py-3 px-4">
                    @if (patient.medicalAlert.hasHighRisk || patient.medicalAlert.allergies.length > 0) {
                      <div class="space-y-0.5">
                        @for (allergy of patient.medicalAlert.allergies; track allergy) {
                          <div class="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <mat-icon class="text-xs" style="font-size: 14px; width: 14px; height: 14px;">warning</mat-icon>
                            <span>Allergie : {{ allergy }}</span>
                          </div>
                        }
                        @for (cond of patient.medicalAlert.medicalConditions; track cond) {
                          <div class="text-[11px] text-amber-600 dark:text-amber-400">
                            {{ cond }}
                          </div>
                        }
                      </div>
                    } @else {
                      <span class="text-neutral-400 text-[11px]">Aucun antécédent critique</span>
                    }
                  </td>

                  <td class="py-3 px-4">
                    @if (patient.nextRecall) {
                      <div class="font-medium text-neutral-800 dark:text-neutral-200">
                        {{ i18n.formatDate(patient.nextRecall.dueDate) }}
                      </div>
                      <div class="text-[10px] text-teal-600 dark:text-teal-400 capitalize">
                        {{ patient.nextRecall.type.replace('_', ' ') }}
                      </div>
                    } @else {
                      <span class="text-neutral-400 text-[11px]">-</span>
                    }
                  </td>

                  <td class="py-3 px-4 text-right font-mono tabular-nums font-bold">
                    @if (patient.balanceDue > 0) {
                      <span class="text-amber-600 dark:text-amber-400">
                        {{ i18n.formatCurrency(patient.balanceDue) }}
                      </span>
                    } @else {
                      <span class="text-emerald-600 dark:text-emerald-400 font-normal">
                        0 MAD
                      </span>
                    }
                  </td>

                  <td class="py-3 px-4 text-right">
                    <button
                      (click)="onSelectPatient(patient.id)"
                      class="px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 font-semibold text-xs transition-colors">
                      Ouvrir dossier
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="py-12 text-center text-neutral-400 text-xs italic">
                    Aucun dossier patient ne correspond à votre recherche
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal: Nouveau Patient -->
      @if (showNewPatientModal()) {
        <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 class="text-base font-bold text-neutral-900 dark:text-white">Créer un Nouveau Dossier Patient</h3>
              <button (click)="showNewPatientModal.set(false)" class="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
                <mat-icon class="text-sm">close</mat-icon>
              </button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Prénom *</span>
                  <input type="text" [(ngModel)]="newFirstName" placeholder="Ex: Amina" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
                </div>
                <div>
                  <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Nom *</span>
                  <input type="text" [(ngModel)]="newLastName" placeholder="Ex: Tazi" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
                </div>
              </div>

              <div class="grid grid-cols-3 gap-3">
                <div>
                  <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">CIN / ID</span>
                  <input type="text" [(ngModel)]="newCin" placeholder="Ex: BK123456" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
                </div>
                <div>
                  <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Genre</span>
                  <select [(ngModel)]="newGender" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white">
                    <option value="F">Femme</option>
                    <option value="M">Homme</option>
                  </select>
                </div>
                <div>
                  <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Date de naissance</span>
                  <input type="date" [(ngModel)]="newBirthDate" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Téléphone mobile *</span>
                  <input type="tel" [(ngModel)]="newPhone" placeholder="+212 6..." class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
                </div>
                <div>
                  <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Email</span>
                  <input type="email" [(ngModel)]="newEmail" placeholder="patient@email.com" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Ville</span>
                  <input type="text" [(ngModel)]="newCity" placeholder="Casablanca, Rabat..." class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
                </div>
                <div>
                  <span class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Adresse</span>
                  <input type="text" [(ngModel)]="newAddress" placeholder="Rue, quartier, résidence..." class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
                </div>
              </div>

              <!-- Medical Alert info -->
              <div class="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <h4 class="font-bold text-neutral-800 dark:text-neutral-200 text-xs">Antécédents Médicaux & Risques</h4>
                <div>
                  <span class="block font-medium text-neutral-600 dark:text-neutral-400 mb-1">Allergies connues (séparer par des virgules)</span>
                  <input type="text" [(ngModel)]="newAllergies" placeholder="Ex: Pénicilline, Latex, AINS..." class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
                </div>
                <div>
                  <span class="block font-medium text-neutral-600 dark:text-neutral-400 mb-1">Pathologies (Diabète, HTA, Anticoagulants, etc.)</span>
                  <input type="text" [(ngModel)]="newConditions" placeholder="Ex: Diabète type 2, HTA..." class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <button (click)="showNewPatientModal.set(false)" class="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                Annuler
              </button>
              <button (click)="saveNewPatient()" class="px-4 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm">
                Créer le dossier
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PatientListComponent {
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);
  readonly tenantService = inject(TenantService);

  readonly selectPatient = output<string>();

  searchQuery = '';
  readonly filterType = signal<'all' | 'alerts' | 'balance'>('all');
  readonly showNewPatientModal = signal<boolean>(false);

  newFirstName = '';
  newLastName = '';
  newCin = '';
  newGender: 'M' | 'F' = 'F';
  newBirthDate = '1990-01-01';
  newPhone = '+212 ';
  newEmail = '';
  newCity = 'Casablanca';
  newAddress = '';
  newAllergies = '';
  newConditions = '';

  readonly filteredPatients = computed(() => {
    let list = this.dataService.searchPatients(this.searchQuery);
    if (this.filterType() === 'alerts') {
      list = list.filter((p) => p.medicalAlert.hasHighRisk || p.medicalAlert.allergies.length > 0);
    } else if (this.filterType() === 'balance') {
      list = list.filter((p) => p.balanceDue > 0);
    }
    return list;
  });

  onSelectPatient(patientId: string): void {
    this.dataService.selectPatient(patientId);
    this.selectPatient.emit(patientId);
  }

  saveNewPatient(): void {
    if (!this.newFirstName || !this.newLastName) return;

    const allergies = this.newAllergies
      ? this.newAllergies.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const medicalConditions = this.newConditions
      ? this.newConditions.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const p = this.dataService.addPatient({
      organizationId: this.tenantService.currentOrganizationId(),
      clinicIds: [this.tenantService.currentClinicId()],
      patientNumber: `DEN-2026-${String(this.dataService.patients().length + 1).padStart(4, '0')}`,
      firstName: this.newFirstName,
      lastName: this.newLastName,
      cin: this.newCin,
      gender: this.newGender,
      birthDate: this.newBirthDate,
      phone: this.newPhone,
      email: this.newEmail,
      city: this.newCity,
      address: this.newAddress,
      medicalAlert: {
        allergies,
        medicalConditions,
        medications: [],
        hasHighRisk: allergies.length > 0 || medicalConditions.length > 0,
      },
    });

    this.showNewPatientModal.set(false);
    this.onSelectPatient(p.id);
  }
}
