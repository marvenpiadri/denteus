import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { DentalDataService } from '../../core/services/dental-data.service';
import { TenantService } from '../../core/services/tenant.service';
import { ThemeService } from '../../core/services/theme.service';
import { PaymentMethodType } from '../../core/models/billing.models';
import { PatientOdontogramComponent } from './patient-odontogram.component';
import { PatientWorkspaceHeaderComponent } from './patient-workspace-header.component';
import { PatientPeriodontalComponent } from './patient-periodontal.component';
import { PatientTreatmentPlansComponent } from './patient-treatment-plans.component';
import type { PatientWorkspaceTab } from './patient-workspace.models';

@Component({
  selector: 'app-patient-detail',
  imports: [CommonModule, FormsModule, MatIconModule, PatientOdontogramComponent, PatientWorkspaceHeaderComponent, PatientPeriodontalComponent, PatientTreatmentPlansComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <app-patient-workspace-header
        [patient]="patient()"
        [activeTab]="activeTab()"
        [periodontalCount]="dataService.activePatientPerioExams().length"
        [treatmentCount]="dataService.activePatientTreatmentPlans().length"
        [notesCount]="dataService.activePatientNotes().length"
        (goBack)="goBack.emit()"
        (tabChange)="activeTab.set($event)" />

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
      <div [class.hidden]="activeTab() !== 'odontogram'">
        <app-patient-odontogram
          [patientId]="patient().id"
          [organizationId]="patient().organizationId"
          [clinicId]="tenantService.currentClinicId()"
          [updatedBy]="tenantService.currentUser().name"
          [numberingSystem]="dataService.numberingSystem()"
          [darkMode]="themeService.isDark()" />
      </div>

      @if (activeTab() === 'periodontal') {
        <app-patient-periodontal [patientId]="patient().id" />
      }

      @if (activeTab() === 'treatment') {
        <app-patient-treatment-plans [patientId]="patient().id" />
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
export class PatientDetailComponent {
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);
  readonly tenantService = inject(TenantService);
  readonly themeService = inject(ThemeService);
  readonly odontogramTreatmentPlan = inject(OdontogramTreatmentPlanService);
  readonly odontogramPersistence = inject(OdontogramPersistenceService);

  readonly goBack = output<void>();

  readonly activeTab = signal<PatientWorkspaceTab>('odontogram');
  // Modal flags
  readonly showNewPlanModal = signal<boolean>(false);
  readonly showNewNoteModal = signal<boolean>(false);
  readonly showNewPaymentModal = signal<boolean>(false);

  newPaymentAmount = 1000;
  newPaymentMethod: PaymentMethodType = 'card';
  newPaymentRef = '';

  readonly patient = computed(() => this.dataService.activePatient());

  readonly patientPayments = computed(() => {
    return this.dataService.payments().filter((p) => p.patientId === this.patient().id);
  });

  calculateAge(birthDate: string): number {
    if (!birthDate) return 0;
    const diff = Date.now() - new Date(birthDate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
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
