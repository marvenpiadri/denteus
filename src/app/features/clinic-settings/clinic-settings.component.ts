import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { TenantService } from '../../core/services/tenant.service';

@Component({
  selector: 'app-clinic-settings',
  imports: [CommonModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 class="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <mat-icon class="text-teal-600 dark:text-teal-400">settings</mat-icon>
            <span>Paramètres de la Clinique & Gestion de l'Équipe</span>
          </h1>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Organisation : {{ tenantService.currentOrganization().name }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Clinic Information & Chairs -->
        <div class="lg:col-span-1 space-y-6">
          <div class="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <h2 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              Coordonnées du Site
            </h2>

            <div class="space-y-3 text-xs">
              <div>
                <span class="block font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Nom du Cabinet / Clinique</span>
                <input type="text" [(ngModel)]="currentClinicName" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
              </div>

              <div>
                <span class="block font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Ville & Adresse</span>
                <input type="text" [(ngModel)]="currentClinicAddress" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
              </div>

              <div>
                <span class="block font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Téléphone d'accueil</span>
                <input type="text" [(ngModel)]="currentClinicPhone" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
              </div>

              <div>
                <span class="block font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Horaires d'ouverture</span>
                <input type="text" [(ngModel)]="currentClinicHours" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white" />
              </div>
            </div>
          </div>

          <!-- Operatories / Chairs -->
          <div class="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3">
            <h2 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              Fauteuils Dentaires ({{ tenantService.currentClinicChairs().length }})
            </h2>

            <div class="space-y-2">
              @for (chair of tenantService.currentClinicChairs(); track chair.id) {
                <div class="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 flex items-center justify-between text-xs">
                  <div>
                    <div class="font-bold text-neutral-900 dark:text-white">{{ chair.name }}</div>
                    <div class="text-[11px] text-neutral-400">{{ chair.roomNumber }}</div>
                  </div>
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    Opérationnel
                  </span>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Team Members & Roles -->
        <div class="lg:col-span-2 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
            <h2 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              Équipe Médicale & Personnel du Cabinet
            </h2>
            <button class="px-3 py-1.5 text-xs font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors flex items-center gap-1">
              <mat-icon class="text-xs">person_add</mat-icon>
              <span>Inviter un collaborateur</span>
            </button>
          </div>

          <div class="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
            @for (user of tenantService.users(); track user.id) {
              <div class="py-3.5 flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div
                    class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0"
                    [style.backgroundColor]="user.color">
                    {{ user.name.charAt(0) }}
                  </div>
                  <div>
                    <div class="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span>{{ user.name }}</span>
                      @if (user.licenseNumber) {
                        <span class="text-[10px] font-mono text-neutral-400 font-normal">
                          ({{ user.licenseNumber }})
                        </span>
                      }
                    </div>
                    <div class="text-neutral-500 text-[11px]">
                      {{ user.specialty || user.role }} · {{ user.email }} · {{ user.phone }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 capitalize">
                    {{ user.role.replace('_', ' ') }}
                  </span>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})

export class ClinicSettingsComponent {
  readonly i18n = inject(I18nService);
  readonly tenantService = inject(TenantService);

  currentClinicName = this.tenantService.currentClinic().name;
  currentClinicAddress = this.tenantService.currentClinic().address;
  currentClinicPhone = this.tenantService.currentClinic().phone;
  currentClinicHours = this.tenantService.currentClinic().openingHours;
}
