import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { DentalDataService } from '../../core/services/dental-data.service';
import { TenantService } from '../../core/services/tenant.service';
import { ThemeService } from '../../core/services/theme.service';
import { OdontogramAdapterService } from '../../core/services/odontogram-adapter.service';
import { OdontogramPersistenceService } from '../../core/services/odontogram-persistence.service';
import { ToothConditionType, ToothSurface } from '../../core/models/dental.models';
import { PeriodontalDiagnosisCategory, PeriodontalExamination, ToothPerioMeasurement } from '../../core/models/periodontal.models';
import { PaymentMethodType } from '../../core/models/billing.models';
import { Language, OdontogramShellComponent } from 'angular-advanced-odontogram';

export type PatientWorkspaceTab =
  | 'overview'
  | 'odontogram'
  | 'periodontal'
  | 'treatment'
  | 'notes'
  | 'documents'
  | 'billing';

@Component({
  selector: 'app-patient-detail',
  imports: [CommonModule, FormsModule, MatIconModule, OdontogramShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host ::ng-deep aao-odontogram-shell aao-odontogram-topbar > header,
    :host ::ng-deep aao-odontogram-topbar > header,
    :host ::ng-deep aao-odontogram-topbar {
      display: none !important;
    }
  `],
  template: `
    <div class="space-y-6">
      <!-- Back button & Patient Header Card -->
      <div class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-4">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <button
              (click)="goBack.emit()"
              class="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors">
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
            <!-- Balance due badge -->
            <div class="text-right">
              <div class="text-[10px] text-neutral-400 uppercase font-semibold">Reste à payer</div>
              <div class="text-sm font-bold font-mono"
                [class.text-amber-600]="patient().balanceDue > 0"
                [class.text-emerald-600]="patient().balanceDue === 0">
                {{ i18n.formatCurrency(patient().balanceDue) }}
              </div>
            </div>

            <!-- Quick Action: Planifier RDV -->
            <button
              (click)="activeTab.set('treatment')"
              class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow-sm transition-colors">
              <mat-icon class="text-xs" style="font-size: 16px; width: 16px; height: 16px;">receipt_long</mat-icon>
              <span>Plans de soins</span>
            </button>
          </div>
        </div>

        <!-- Medical Alert Banner if applicable -->
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

        <!-- Workspace Tabs -->
        <div class="flex items-center gap-1 border-t border-neutral-200 dark:border-neutral-800 pt-3 overflow-x-auto">
          <button
            (click)="activeTab.set('overview')"
            [class.bg-teal-50]="activeTab() === 'overview'"
            [class.text-teal-700]="activeTab() === 'overview'"
            [class.dark:bg-teal-950/70]="activeTab() === 'overview'"
            [class.dark:text-teal-300]="activeTab() === 'overview'"
            [class.text-neutral-600]="activeTab() !== 'overview'"
            [class.dark:text-neutral-400]="activeTab() !== 'overview'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5">
            <mat-icon class="text-xs" style="font-size: 16px; width: 16px; height: 16px;">info</mat-icon>
            <span>Vue d'ensemble</span>
          </button>

          <button
            (click)="activeTab.set('odontogram')"
            [class.bg-teal-50]="activeTab() === 'odontogram'"
            [class.text-teal-700]="activeTab() === 'odontogram'"
            [class.dark:bg-teal-950/70]="activeTab() === 'odontogram'"
            [class.dark:text-teal-300]="activeTab() === 'odontogram'"
            [class.text-neutral-600]="activeTab() !== 'odontogram'"
            [class.dark:text-neutral-400]="activeTab() !== 'odontogram'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5">
            <mat-icon class="text-xs" style="font-size: 16px; width: 16px; height: 16px;">view_module</mat-icon>
            <span>Odontogramme (Schéma dentaire)</span>
          </button>

          <button
            (click)="activeTab.set('periodontal')"
            [class.bg-teal-50]="activeTab() === 'periodontal'"
            [class.text-teal-700]="activeTab() === 'periodontal'"
            [class.dark:bg-teal-950/70]="activeTab() === 'periodontal'"
            [class.dark:text-teal-300]="activeTab() === 'periodontal'"
            [class.text-neutral-600]="activeTab() !== 'periodontal'"
            [class.dark:text-neutral-400]="activeTab() !== 'periodontal'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5">
            <mat-icon class="text-xs" style="font-size: 16px; width: 16px; height: 16px;">water_drop</mat-icon>
            <span>Bilan Parodontal ({{ dataService.activePatientPerioExams().length }})</span>
          </button>

          <button
            (click)="activeTab.set('treatment')"
            [class.bg-teal-50]="activeTab() === 'treatment'"
            [class.text-teal-700]="activeTab() === 'treatment'"
            [class.dark:bg-teal-950/70]="activeTab() === 'treatment'"
            [class.dark:text-teal-300]="activeTab() === 'treatment'"
            [class.text-neutral-600]="activeTab() !== 'treatment'"
            [class.dark:text-neutral-400]="activeTab() !== 'treatment'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5">
            <mat-icon class="text-xs" style="font-size: 16px; width: 16px; height: 16px;">receipt</mat-icon>
            <span>Plans de Traitement ({{ dataService.activePatientTreatmentPlans().length }})</span>
          </button>

          <button
            (click)="activeTab.set('notes')"
            [class.bg-teal-50]="activeTab() === 'notes'"
            [class.text-teal-700]="activeTab() === 'notes'"
            [class.dark:bg-teal-950/70]="activeTab() === 'notes'"
            [class.dark:text-teal-300]="activeTab() === 'notes'"
            [class.text-neutral-600]="activeTab() !== 'notes'"
            [class.dark:text-neutral-400]="activeTab() !== 'notes'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5">
            <mat-icon class="text-xs" style="font-size: 16px; width: 16px; height: 16px;">edit_note</mat-icon>
            <span>Notes SOAP ({{ dataService.activePatientNotes().length }})</span>
          </button>

          <button
            (click)="activeTab.set('documents')"
            [class.bg-teal-50]="activeTab() === 'documents'"
            [class.text-teal-700]="activeTab() === 'documents'"
            [class.dark:bg-teal-950/70]="activeTab() === 'documents'"
            [class.dark:text-teal-300]="activeTab() === 'documents'"
            [class.text-neutral-600]="activeTab() !== 'documents'"
            [class.dark:text-neutral-400]="activeTab() !== 'documents'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5">
            <mat-icon class="text-xs" style="font-size: 16px; width: 16px; height: 16px;">image</mat-icon>
            <span>Radios & Documents</span>
          </button>

          <button
            (click)="activeTab.set('billing')"
            [class.bg-teal-50]="activeTab() === 'billing'"
            [class.text-teal-700]="activeTab() === 'billing'"
            [class.dark:bg-teal-950/70]="activeTab() === 'billing'"
            [class.dark:text-teal-300]="activeTab() === 'billing'"
            [class.text-neutral-600]="activeTab() !== 'billing'"
            [class.dark:text-neutral-400]="activeTab() !== 'billing'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5">
            <mat-icon class="text-xs" style="font-size: 16px; width: 16px; height: 16px;">account_balance_wallet</mat-icon>
            <span>Facturation & Règlements</span>
          </button>
        </div>
      </div>

      <!-- TAB CONTENT: OVERVIEW -->
      @if (activeTab() === 'overview') {
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left: Identity & Contacts -->
          <div class="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <h2 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              Informations Administratives
            </h2>
            <div class="space-y-2.5 text-xs">
              <div class="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                <span class="text-neutral-400">Date de naissance</span>
                <span class="font-medium text-neutral-900 dark:text-white">{{ i18n.formatDate(patient().birthDate) }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                <span class="text-neutral-400">Groupe Sanguin</span>
                <span class="font-medium text-neutral-900 dark:text-white">{{ patient().medicalAlert.bloodGroup || 'Non renseigné' }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                <span class="text-neutral-400">Téléphone</span>
                <span class="font-medium text-neutral-900 dark:text-white">{{ patient().phone }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                <span class="text-neutral-400">Email</span>
                <span class="font-medium text-neutral-900 dark:text-white">{{ patient().email || 'Non renseigné' }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                <span class="text-neutral-400">Adresse</span>
                <span class="font-medium text-neutral-900 dark:text-white text-right">{{ patient().address }}, {{ patient().city }}</span>
              </div>
            </div>

            @if (patient().emergencyContact) {
              <div class="pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <h3 class="text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-2">Personne à contacter</h3>
                <div class="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl text-xs space-y-1">
                  <div class="font-semibold text-neutral-900 dark:text-white">{{ patient().emergencyContact?.name }} ({{ patient().emergencyContact?.relationship }})</div>
                  <div class="text-neutral-500">{{ patient().emergencyContact?.phone }}</div>
                </div>
              </div>
            }
          </div>

          <!-- Middle & Right: Clinical Timeline -->
          <div class="lg:col-span-2 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <h2 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
              <span>Chronologie des Événements Cliniques</span>
              <span class="text-[11px] font-normal text-neutral-400">Historique complet des consultations et soins</span>
            </h2>

            <div class="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200 dark:before:bg-neutral-800">
              @for (apt of dataService.activePatientAppointments(); track apt.id) {
                <div class="relative">
                  <div class="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-teal-600 ring-4 ring-white dark:ring-neutral-900"></div>
                  <div class="text-xs font-mono text-neutral-400">
                    {{ i18n.formatDate(apt.startTime) }} · {{ apt.startTime.split('T')[1].substring(0, 5) }}
                  </div>
                  <div class="font-bold text-xs text-neutral-900 dark:text-white mt-0.5">
                    {{ apt.reason }} ({{ apt.appointmentType }})
                  </div>
                  <div class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    Praticien : {{ apt.doctorName }} · Fauteuil : {{ apt.chairName }} · Statut : {{ apt.status }}
                  </div>
                </div>
              }

              @for (plan of dataService.activePatientTreatmentPlans(); track plan.id) {
                <div class="relative">
                  <div class="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-white dark:ring-neutral-900"></div>
                  <div class="text-xs font-mono text-neutral-400">{{ i18n.formatDate(plan.createdAt) }}</div>
                  <div class="font-bold text-xs text-neutral-900 dark:text-white mt-0.5">
                    Plan de traitement établi : {{ plan.title }}
                  </div>
                  <div class="text-[11px] text-neutral-500 mt-1">
                    Montant : {{ i18n.formatCurrency(plan.total) }} ({{ plan.items.length }} actes) · Statut : {{ plan.status }}
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- TAB CONTENT: ODONTOGRAM -->
      @if (activeTab() === 'odontogram') {
        <div class="space-y-4">
          <!-- Odontogram Toolbar -->
          <div class="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="text-xs font-bold text-neutral-900 dark:text-white">Système de Numérotation :</span>
              <div class="flex items-center rounded-lg p-0.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <button
                  (click)="dataService.numberingSystem.set('FDI')"
                  [class.bg-white]="dataService.numberingSystem() === 'FDI'"
                  [class.dark:bg-neutral-700]="dataService.numberingSystem() === 'FDI'"
                  [class.shadow-sm]="dataService.numberingSystem() === 'FDI'"
                  class="px-2.5 py-1 text-xs font-bold rounded text-neutral-700 dark:text-neutral-200 transition-colors">
                  FDI (ISO)
                </button>
                <button
                  (click)="dataService.numberingSystem.set('UNIVERSAL')"
                  [class.bg-white]="dataService.numberingSystem() === 'UNIVERSAL'"
                  [class.dark:bg-neutral-700]="dataService.numberingSystem() === 'UNIVERSAL'"
                  [class.shadow-sm]="dataService.numberingSystem() === 'UNIVERSAL'"
                  class="px-2.5 py-1 text-xs font-bold rounded text-neutral-700 dark:text-neutral-200 transition-colors">
                  Universal (ADA)
                </button>
                <button
                  (click)="dataService.numberingSystem.set('PALMER')"
                  [class.bg-white]="dataService.numberingSystem() === 'PALMER'"
                  [class.dark:bg-neutral-700]="dataService.numberingSystem() === 'PALMER'"
                  [class.shadow-sm]="dataService.numberingSystem() === 'PALMER'"
                  class="px-2.5 py-1 text-xs font-bold rounded text-neutral-700 dark:text-neutral-200 transition-colors">
                  Palmer
                </button>
              </div>
            </div>

            <!-- Indicators: Language & Advanced Odontogram -->
            <div class="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
              <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-medium">
                <mat-icon style="font-size: 16px; width: 16px; height: 16px;" class="text-teal-600 dark:text-teal-400">translate</mat-icon>
                <span>Langue active : <strong class="uppercase text-neutral-900 dark:text-white">{{ odontogramLanguage() }}</strong></span>
              </span>
              <span class="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 font-semibold border border-teal-200 dark:border-teal-800">
                Angular Odontogramme Avancé
              </span>
            </div>
          </div>

          @if (odontogramViewMode() === 'advanced') {
            <div class="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden min-h-[500px]">
              @defer (on timer(10ms)) {
                <aao-odontogram-shell
                  [numberingSystem]="dataService.numberingSystem()"
                  [darkMode]="themeService.isDark()"
                  [showStatusCard]="true"
                  [showOrthoCard]="true"
                  [enableNotes]="true"
                  [enableIcdas]="true" />
              } @placeholder {
                <div class="p-16 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-2">
                  <div class="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Chargement de l'odontogramme haute résolution...</span>
                </div>
              }
            </div>
          } @else {
          <!-- Interactive SVG Dental Odontogram Arch -->
          <div class="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-8">
            <!-- Upper Arch (Maxillaire) -->
            <div>
              <div class="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2 text-center">
                Maxillaire Supérieur
              </div>
              <div class="grid grid-cols-8 sm:grid-cols-16 gap-1.5 max-w-4xl mx-auto">
                @for (t of odontogramViewModels().upper; track t.toothNumber) {
                  <button
                    (click)="onSelectTooth(t.toothNumber)"
                    [class.ring-2]="selectedToothNumber() === t.toothNumber"
                    [class.ring-teal-500]="selectedToothNumber() === t.toothNumber"
                    class="flex flex-col items-center justify-between p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-teal-400 bg-neutral-50 dark:bg-neutral-800/40 transition-all h-24 relative group">
                    <span class="text-[11px] font-mono font-bold text-neutral-600 dark:text-neutral-400">
                      {{ t.label }}
                    </span>

                    <!-- Visual Tooth Symbol -->
                    <div class="w-8 h-12 flex items-center justify-center relative">
                      @if (t.isMissing) {
                        <span class="text-neutral-400 font-bold text-lg">✕</span>
                      } @else if (t.isImplant) {
                        <mat-icon class="text-cyan-500" style="font-size: 24px; width: 24px; height: 24px;">settings_suggest</mat-icon>
                      } @else {
                        <!-- Tooth crown & root graphic -->
                        <div class="flex flex-col items-center">
                          <div class="w-5 h-6 rounded-t-lg border-2"
                            [style.borderColor]="t.statusColor"
                            [style.backgroundColor]="t.condition ? t.statusColor + '20' : 'transparent'"></div>
                          <div class="w-2.5 h-5 rounded-b-md border"
                            [style.borderColor]="t.isEndoTreated ? '#8b5cf6' : t.statusColor"
                            [style.backgroundColor]="t.isEndoTreated ? '#8b5cf6' : 'transparent'"></div>
                        </div>
                      }
                    </div>

                    <!-- Surface Badges if any -->
                    <div class="text-[9px] font-mono font-bold text-neutral-500 truncate max-w-full">
                      {{ t.surfaces.join('') || '-' }}
                    </div>
                  </button>
                }
              </div>
            </div>

            <!-- Lower Arch (Mandibule) -->
            <div>
              <div class="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2 text-center">
                Mandibule Inférieure
              </div>
              <div class="grid grid-cols-8 sm:grid-cols-16 gap-1.5 max-w-4xl mx-auto">
                @for (t of odontogramViewModels().lower; track t.toothNumber) {
                  <button
                    (click)="onSelectTooth(t.toothNumber)"
                    [class.ring-2]="selectedToothNumber() === t.toothNumber"
                    [class.ring-teal-500]="selectedToothNumber() === t.toothNumber"
                    class="flex flex-col items-center justify-between p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-teal-400 bg-neutral-50 dark:bg-neutral-800/40 transition-all h-24 relative group">
                    <!-- Surface Badges -->
                    <div class="text-[9px] font-mono font-bold text-neutral-500 truncate max-w-full">
                      {{ t.surfaces.join('') || '-' }}
                    </div>

                    <!-- Visual Tooth Symbol -->
                    <div class="w-8 h-12 flex items-center justify-center relative">
                      @if (t.isMissing) {
                        <span class="text-neutral-400 font-bold text-lg">✕</span>
                      } @else if (t.isImplant) {
                        <mat-icon class="text-cyan-500" style="font-size: 24px; width: 24px; height: 24px;">settings_suggest</mat-icon>
                      } @else {
                        <div class="flex flex-col items-center">
                          <div class="w-2.5 h-5 rounded-t-md border"
                            [style.borderColor]="t.isEndoTreated ? '#8b5cf6' : t.statusColor"
                            [style.backgroundColor]="t.isEndoTreated ? '#8b5cf6' : 'transparent'"></div>
                          <div class="w-5 h-6 rounded-b-lg border-2"
                            [style.borderColor]="t.statusColor"
                            [style.backgroundColor]="t.condition ? t.statusColor + '20' : 'transparent'"></div>
                        </div>
                      }
                    </div>

                    <span class="text-[11px] font-mono font-bold text-neutral-600 dark:text-neutral-400">
                      {{ t.label }}
                    </span>
                  </button>
                }
              </div>
            </div>
          </div>

          <!-- Tooth Inspector / Surface Editor Drawer -->
          @if (selectedToothNumber()) {
            <div class="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-teal-500/40 shadow-sm space-y-4 animate-in fade-in">
              <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-bold text-neutral-900 dark:text-white">
                    Dent {{ selectedToothLabel() }} (FDI {{ selectedToothNumber() }})
                  </h3>
                  <span class="text-xs text-neutral-400">
                    Quadrant {{ getToothQuadrant(selectedToothNumber()!) }}
                  </span>
                </div>

                <button (click)="selectedToothNumber.set(null)" class="text-neutral-400 hover:text-neutral-700">
                  <mat-icon class="text-sm">close</mat-icon>
                </button>
              </div>

              <!-- Conditions & Surface controls -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Select Condition -->
                <div class="space-y-2">
                  <span class="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">État / Pathologie</span>
                  <select
                    [(ngModel)]="editConditionType"
                    class="w-full p-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white">
                    <option value="healthy">Dent saine (Aucun acte requis)</option>
                    <option value="caries">Carie dentinaire active</option>
                    <option value="filling">Restauration composite existante</option>
                    <option value="endo_needed">Pulpite / Nécrose (Endodontie requise)</option>
                    <option value="endo_treated">Dévitalisée (Obturation canalaire)</option>
                    <option value="crown">Couronne prothétique (CCM / Zircone)</option>
                    <option value="implant">Implant ostéointégré</option>
                    <option value="missing">Dent absente / Extraite</option>
                  </select>
                </div>

                <!-- Select Affected Surfaces -->
                <div class="space-y-2">
                  <span class="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">Surfaces atteintes</span>
                  <div class="flex items-center gap-2">
                    @for (surf of ['M', 'O', 'D', 'B', 'L']; track surf) {
                      <button
                        (click)="toggleSurface(surf)"
                        [class.bg-teal-600]="editSurfaces.includes(surf)"
                        [class.text-white]="editSurfaces.includes(surf)"
                        [class.bg-neutral-100]="!editSurfaces.includes(surf)"
                        [class.dark:bg-neutral-800]="!editSurfaces.includes(surf)"
                        [class.text-neutral-700]="!editSurfaces.includes(surf)"
                        [class.dark:text-neutral-300]="!editSurfaces.includes(surf)"
                        class="w-8 h-8 rounded-lg text-xs font-bold font-mono transition-colors">
                        {{ surf }}
                      </button>
                    }
                  </div>
                  <div class="text-[10px] text-neutral-400">M: Mésial, O: Occlusal, D: Distal, B: Vestibulaire, L: Lingual</div>
                </div>

                <!-- Action Button -->
                <div class="space-y-2 flex flex-col justify-end">
                  <button
                    (click)="saveToothCondition()"
                    class="w-full py-2.5 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-colors">
                    Enregistrer l'état clinique
                  </button>
                </div>
              </div>
            </div>
          }
        }
        </div>
      }

      <!-- TAB CONTENT: PERIODONTAL -->
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

      <!-- TAB CONTENT: TREATMENT PLANS -->
      @if (activeTab() === 'treatment') {
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              Plans de Traitement & Devis
            </h2>
            <button
              (click)="showNewPlanModal.set(true)"
              class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors flex items-center gap-1.5 shadow-sm">
              <mat-icon class="text-xs">add</mat-icon>
              <span>Nouveau Plan de Soins</span>
            </button>
          </div>

          <div class="space-y-4">
            @for (plan of dataService.activePatientTreatmentPlans(); track plan.id) {
              <div class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-4">
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

                <!-- Items list -->
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
                          <td class="py-2.5 font-medium text-neutral-900 dark:text-white">
                            {{ item.procedureName }}
                          </td>
                          <td class="py-2.5 text-neutral-400 capitalize">
                            {{ item.category.replace('_', ' ') }}
                          </td>
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
              </div>
            } @empty {
              <div class="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-400 italic">
                Aucun plan de traitement enregistré pour ce patient
              </div>
            }
          </div>
        </div>
      }

      <!-- TAB CONTENT: CLINICAL NOTES (SOAP) -->
      @if (activeTab() === 'notes') {
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              Notes Cliniques (SOAP) & Observations Médico-Légales
            </h2>
            <button
              (click)="showNewNoteModal.set(true)"
              class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors flex items-center gap-1.5 shadow-sm">
              <mat-icon class="text-xs">add</mat-icon>
              <span>Ajouter une observation</span>
            </button>
          </div>

          <div class="space-y-4">
            @for (note of dataService.activePatientNotes(); track note.id) {
              <div class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-3">
                <div class="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800 text-xs">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-neutral-900 dark:text-white">{{ note.authorName }}</span>
                    <span class="text-neutral-400">· {{ i18n.formatDate(note.date) }}</span>
                    @if (note.toothNumber) {
                      <span class="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-mono font-bold text-[10px]">
                        Dent {{ note.toothNumber }}
                      </span>
                    }
                  </div>

                  @if (note.isLocked) {
                    <span class="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      <mat-icon class="text-xs" style="font-size: 14px; width: 14px; height: 14px;">lock</mat-icon>
                      <span>Verrouillé (Certifié)</span>
                    </span>
                  }
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div class="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40">
                    <div class="font-bold text-neutral-700 dark:text-neutral-300 mb-1">Subjectif / Motif :</div>
                    <div class="text-neutral-600 dark:text-neutral-400">{{ note.subjective || '-' }}</div>
                  </div>
                  <div class="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40">
                    <div class="font-bold text-neutral-700 dark:text-neutral-300 mb-1">Objectif / Examen clinique :</div>
                    <div class="text-neutral-600 dark:text-neutral-400">{{ note.objective || '-' }}</div>
                  </div>
                  <div class="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40">
                    <div class="font-bold text-neutral-700 dark:text-neutral-300 mb-1">Évaluation / Diagnostic :</div>
                    <div class="text-neutral-600 dark:text-neutral-400">{{ note.assessment || '-' }}</div>
                  </div>
                  <div class="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40">
                    <div class="font-bold text-neutral-700 dark:text-neutral-300 mb-1">Plan / Soins réalisés :</div>
                    <div class="text-neutral-600 dark:text-neutral-400">{{ note.plan || '-' }}</div>
                  </div>
                </div>
              </div>
            } @empty {
              <div class="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-400 italic">
                Aucune note clinique enregistrée pour ce patient
              </div>
            }
          </div>
        </div>
      }

      <!-- TAB CONTENT: DOCUMENTS & RADIOS -->
      @if (activeTab() === 'documents') {
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              Imagerie & Documents Médico-Légaux
            </h2>
            <span class="text-xs text-neutral-400">Stockage sécurisé</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            @for (doc of dataService.activePatientDocuments(); track doc.id) {
              <div class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm flex flex-col justify-between">
                <div>
                  <div class="h-40 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden">
                    <img [src]="doc.fileUrl" [alt]="doc.title" class="object-cover w-full h-full" referrerpolicy="no-referrer" />
                  </div>
                  <div class="p-4 space-y-1">
                    <div class="text-xs font-bold text-neutral-900 dark:text-white">{{ doc.title }}</div>
                    <div class="text-[11px] text-neutral-400">
                      {{ i18n.formatDate(doc.uploadedAt) }} · {{ doc.fileSize }}
                    </div>
                    @if (doc.notes) {
                      <div class="text-[11px] text-neutral-500 mt-2 italic">{{ doc.notes }}</div>
                    }
                  </div>
                </div>

                <div class="p-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
                  <a [href]="doc.fileUrl" target="_blank" class="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline">
                    Visualiser en grand →
                  </a>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- TAB CONTENT: BILLING & PAYMENTS -->
      @if (activeTab() === 'billing') {
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              Factures Émises & Règlements Reçus
            </h2>
            <div class="flex items-center gap-2">
              <button
                (click)="showNewPaymentModal.set(true)"
                class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition-colors">
                Encaisser un règlement
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Invoices list -->
            <div class="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3">
              <h3 class="text-xs font-bold text-neutral-800 dark:text-neutral-200">Factures</h3>
              <div class="space-y-2.5">
                @for (inv of dataService.activePatientInvoices(); track inv.id) {
                  <div class="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold font-mono text-neutral-900 dark:text-white">{{ inv.invoiceNumber }}</span>
                      <span class="text-[10px] font-semibold px-2 py-0.5 rounded"
                        [class.bg-emerald-100]="inv.status === 'paid'"
                        [class.text-emerald-700]="inv.status === 'paid'"
                        [class.bg-amber-100]="inv.status === 'partially_paid'"
                        [class.text-amber-700]="inv.status === 'partially_paid'"
                        [class.bg-rose-100]="inv.status === 'unpaid'"
                        [class.text-rose-700]="inv.status === 'unpaid'">
                        {{ inv.status === 'paid' ? 'Soldée' : inv.status === 'partially_paid' ? 'Acompte versé' : 'Impayée' }}
                      </span>
                    </div>

                    <div class="flex items-center justify-between text-xs">
                      <span class="text-neutral-500">{{ i18n.formatDate(inv.date) }}</span>
                      <span class="font-bold font-mono">{{ i18n.formatCurrency(inv.total) }}</span>
                    </div>

                    @if (inv.balanceDue > 0) {
                      <div class="text-[11px] text-amber-600 font-semibold font-mono">
                        Reste dû : {{ i18n.formatCurrency(inv.balanceDue) }}
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Payments list -->
            <div class="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3">
              <h3 class="text-xs font-bold text-neutral-800 dark:text-neutral-200">Reçus de Paiement</h3>
              <div class="space-y-2.5">
                @for (pay of patientPayments(); track pay.id) {
                  <div class="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-1">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold font-mono text-neutral-900 dark:text-white">{{ pay.receiptNumber }}</span>
                      <span class="text-xs font-bold font-mono text-emerald-600">{{ i18n.formatCurrency(pay.amount) }}</span>
                    </div>
                    <div class="text-[11px] text-neutral-500">
                      {{ i18n.formatDate(pay.paymentDate) }} · Mode : {{ getPaymentMethodName(pay.method) }}
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- MODAL: Nouvel examen parodontal -->
      @if (showNewPerioModal()) {
        <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 class="text-base font-bold text-neutral-900 dark:text-white">Enregistrer Bilan Parodontal</h3>
            <div class="space-y-3 text-xs">
              <div>
                <span class="block font-semibold mb-1">Pourcentage de saignement au sondage (% BOP)</span>
                <input type="number" [(ngModel)]="newPerioBop" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border" />
              </div>
              <div>
                <span class="block font-semibold mb-1">Pertes d'attache maximales (mm CAL)</span>
                <input type="number" [(ngModel)]="newPerioCal" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border" />
              </div>
              <div>
                <span class="block font-semibold mb-1">Diagnostic parodontal</span>
                <select [(ngModel)]="newPerioDx" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border">
                  <option value="Sain">Sain / Gingivite légère</option>
                  <option value="Gingivite">Gingivite induite par la plaque</option>
                  <option value="Parodontite Stade I">Parodontite Stade I (Initiale)</option>
                  <option value="Parodontite Stade II">Parodontite Stade II (Modérée)</option>
                  <option value="Parodontite Stade III">Parodontite Stade III (Sévère)</option>
                  <option value="Parodontite Stade IV">Parodontite Stade IV (Très avancée)</option>
                </select>
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t">
              <button (click)="showNewPerioModal.set(false)" class="px-4 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800">Annuler</button>
              <button (click)="saveNewPerioExam()" class="px-4 py-2 text-xs rounded-xl bg-teal-600 text-white font-semibold">Enregistrer l'examen</button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL: Encaisser un règlement -->
      @if (showNewPaymentModal()) {
        <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 class="text-base font-bold text-neutral-900 dark:text-white">Encaisser un Règlement</h3>
            <div class="space-y-3 text-xs">
              <div>
                <span class="block font-semibold mb-1">Montant à encaisser (MAD)</span>
                <input type="number" [(ngModel)]="newPaymentAmount" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border" />
              </div>
              <div>
                <span class="block font-semibold mb-1">Mode de règlement</span>
                <select [(ngModel)]="newPaymentMethod" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border">
                  <option value="cash">Espèces</option>
                  <option value="card">Carte Bancaire (TPE)</option>
                  <option value="cheque">Chèque</option>
                  <option value="transfer">Virement Bancaire</option>
                  <option value="insurance">Prise en charge Mutuelle / Assurance</option>
                </select>
              </div>
              <div>
                <span class="block font-semibold mb-1">Référence / Numéro</span>
                <input type="text" [(ngModel)]="newPaymentRef" placeholder="Ex: TPE-0981, Chq Attijariwafa..." class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border" />
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t">
              <button (click)="showNewPaymentModal.set(false)" class="px-4 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800">Annuler</button>
              <button (click)="savePayment()" class="px-4 py-2 text-xs rounded-xl bg-teal-600 text-white font-semibold">Valider l'encaissement</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PatientDetailComponent implements AfterViewInit, OnDestroy {
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);
  readonly tenantService = inject(TenantService);
  readonly themeService = inject(ThemeService);
  readonly odontogramAdapter = inject(OdontogramAdapterService);
  readonly odontogramPersistence = inject(OdontogramPersistenceService);

  readonly goBack = output<void>();

  readonly activeTab = signal<PatientWorkspaceTab>('odontogram');
  readonly selectedToothNumber = signal<number | null>(16);
  // The Advanced Odontogram is the single clinical chart UI.
  readonly odontogramViewMode = signal<'advanced'>('advanced');

  // Inspector form fields
  editConditionType: ToothConditionType = 'caries';
  editSurfaces: string[] = ['O', 'D'];

  // Modal flags
  readonly showNewPerioModal = signal<boolean>(false);
  readonly showNewPlanModal = signal<boolean>(false);
  readonly showNewNoteModal = signal<boolean>(false);
  readonly showNewPaymentModal = signal<boolean>(false);

  newPerioBop = 15;
  newPerioCal = 5;
  newPerioDx = 'Parodontite Stade II';

  newPaymentAmount = 1000;
  newPaymentMethod: PaymentMethodType = 'card';
  newPaymentRef = '';

  readonly patient = computed(() => this.dataService.activePatient());

  readonly odontogramViewModels = computed(() => {
    return this.odontogramAdapter.buildTeethViewModels(this.dataService.activePatientConditions());
  });

  readonly selectedToothLabel = computed(() => {
    if (!this.selectedToothNumber()) return '';
    return this.odontogramAdapter.formatToothNumber(this.selectedToothNumber()!);
  });

  readonly patientPayments = computed(() => {
    return this.dataService.payments().filter((p) => p.patientId === this.patient().id);
  });

  ngAfterViewInit(): void {
    const patient = this.patient();
    const user = this.tenantService.currentUser();

    void this.odontogramPersistence.attach(
      patient.id,
      this.tenantService.currentOrganizationId(),
      this.tenantService.currentClinicId(),
      user.name,
    );
  }

  ngOnDestroy(): void {
    this.odontogramPersistence.detach();
  }

  calculateAge(birthDate: string): number {
    if (!birthDate) return 0;
    const diff = Date.now() - new Date(birthDate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  }

  getToothQuadrant(fdi: number): number {
    return Math.floor(fdi / 10);
  }

  onSelectTooth(num: number): void {
    this.selectedToothNumber.set(num);
    const existing = this.dataService.activePatientConditions().find((c) => c.toothNumber === num);
    if (existing) {
      this.editConditionType = existing.condition;
      this.editSurfaces = [...existing.surfaces];
    } else {
      this.editConditionType = 'healthy';
      this.editSurfaces = [];
    }
  }

  toggleSurface(surf: string): void {
    if (this.editSurfaces.includes(surf)) {
      this.editSurfaces = this.editSurfaces.filter((s) => s !== surf);
    } else {
      this.editSurfaces.push(surf);
    }
  }

  saveToothCondition(): void {
    if (!this.selectedToothNumber()) return;

    this.dataService.addOrUpdateToothCondition({
      patientId: this.patient().id,
      toothNumber: this.selectedToothNumber()!,
      condition: this.editConditionType,
      surfaces: this.editSurfaces as ToothSurface[],
      status: 'diagnosed',
      diagnosedAt: new Date().toISOString().split('T')[0],
      createdBy: this.tenantService.currentUser().name,
    });
  }

  getExamTeethEntries(exam: PeriodontalExamination): ToothPerioMeasurement[] {
    return Object.values(exam.measurements);
  }

  getPaymentMethodName(method: PaymentMethodType): string {
    switch (method) {
      case 'cash': return 'Espèces';
      case 'card': return 'Carte bancaire';
      case 'cheque': return 'Chèque';
      case 'transfer': return 'Virement';
      case 'insurance': return 'Prise en charge';
    }
  }

  saveNewPerioExam(): void {
    this.dataService.addPeriodontalExam({
      patientId: this.patient().id,
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

  savePayment(): void {
    this.dataService.recordPayment({
      patientId: this.patient().id,
      clinicId: this.tenantService.currentClinicId(),
      paymentDate: new Date().toISOString().split('T')[0],
      amount: this.newPaymentAmount,
      method: this.newPaymentMethod,
      referenceNumber: this.newPaymentRef,
      recordedBy: this.tenantService.currentUser().name,
    });
    this.showNewPaymentModal.set(false);
  }
}
