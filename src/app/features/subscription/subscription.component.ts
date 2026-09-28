import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { DentalDataService } from '../../core/services/dental-data.service';
import { TenantService } from '../../core/services/tenant.service';
import { SubscriptionPlan } from '../../core/models/audit.models';

@Component({
  selector: 'app-subscription',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8 max-w-5xl mx-auto">
      <!-- Header -->
      <div class="text-center space-y-3">
        <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
          Formules d'Abonnement Denteus SaaS
        </h1>
        <p class="text-xs text-neutral-500 dark:text-neutral-400 max-w-lg mx-auto">
          Plateforme logicielle complète pour chirurgiens-dentistes, cabinets dentaires et cliniques multisites. Sans frais cachés.
        </p>

        <!-- Billing Interval Switcher & Currency -->
        <div class="flex items-center justify-center gap-4 pt-2">
          <div class="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            <button
              (click)="isYearly.set(false)"
              [class.bg-white]="!isYearly()"
              [class.dark:bg-neutral-700]="!isYearly()"
              [class.shadow-sm]="!isYearly()"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg text-neutral-800 dark:text-neutral-200 transition-colors">
              Facturation Mensuelle
            </button>
            <button
              (click)="isYearly.set(true)"
              [class.bg-white]="isYearly()"
              [class.dark:bg-neutral-700]="isYearly()"
              [class.shadow-sm]="isYearly()"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg text-neutral-800 dark:text-neutral-200 transition-colors flex items-center gap-1.5">
              <span>Annuel</span>
              <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                -17% (2 mois offerts)
              </span>
            </button>
          </div>

          <!-- Currency Selector -->
          <div class="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-mono font-bold">
            <button
              (click)="currency.set('MAD')"
              [class.bg-white]="currency() === 'MAD'"
              [class.dark:bg-neutral-700]="currency() === 'MAD'"
              class="px-2 py-1 rounded-lg text-neutral-800 dark:text-neutral-200">
              MAD
            </button>
            <button
              (click)="currency.set('EUR')"
              [class.bg-white]="currency() === 'EUR'"
              [class.dark:bg-neutral-700]="currency() === 'EUR'"
              class="px-2 py-1 rounded-lg text-neutral-800 dark:text-neutral-200">
              EUR (€)
            </button>
          </div>
        </div>
      </div>

      <!-- Plan Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        @for (plan of dataService.subscriptionPlans(); track plan.id) {
          <div
            [class.ring-2]="plan.isPopular"
            [class.ring-teal-500]="plan.isPopular"
            class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col justify-between shadow-sm relative">
            @if (plan.badge) {
              <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-teal-600 text-white text-[10px] font-bold tracking-wide uppercase shadow">
                {{ plan.badge }}
              </div>
            }

            <div class="space-y-4">
              <div>
                <h3 class="text-base font-bold text-neutral-900 dark:text-white">{{ plan.name }}</h3>
                <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1 min-h-[36px]">
                  {{ plan.description }}
                </p>
              </div>

              <!-- Price tag -->
              <div class="py-2 border-y border-neutral-100 dark:border-neutral-800">
                <div class="flex items-baseline gap-1">
                  <span class="text-3xl font-extrabold font-mono text-neutral-900 dark:text-white">
                    {{ getPrice(plan) }}
                  </span>
                  <span class="text-xs text-neutral-400">
                    {{ isYearly() ? '/ an' : '/ mois' }}
                  </span>
                </div>
                <div class="text-[11px] text-neutral-400 mt-0.5">
                  {{ plan.maxChairs }} fauteuil(s) · {{ plan.maxDoctors }} praticien(s) · {{ plan.maxStorageGb }} Go stockage
                </div>
              </div>

              <!-- Feature List -->
              <ul class="space-y-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                @for (feat of plan.features; track feat) {
                  <li class="flex items-start gap-2">
                    <mat-icon class="text-teal-600 text-xs shrink-0 mt-0.5" style="font-size: 16px; width: 16px; height: 16px;">check</mat-icon>
                    <span>{{ feat }}</span>
                  </li>
                }
              </ul>
            </div>

            <div class="pt-6 mt-6 border-t border-neutral-100 dark:border-neutral-800">
              <button
                [class.bg-teal-600]="plan.isPopular"
                [class.hover:bg-teal-700]="plan.isPopular"
                [class.text-white]="plan.isPopular"
                [class.bg-neutral-100]="!plan.isPopular"
                [class.dark:bg-neutral-800]="!plan.isPopular"
                [class.text-neutral-900]="!plan.isPopular"
                [class.dark:text-white]="!plan.isPopular"
                class="w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm">
                {{ plan.id === 'plan-clinic' ? 'Formule Actuelle' : 'Choisir cette formule' }}
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Free Trial Guarantee Banner -->
      <div class="p-5 bg-teal-50 dark:bg-teal-950/40 rounded-2xl border border-teal-200 dark:border-teal-900/60 flex items-center justify-between text-xs">
        <div class="flex items-center gap-3">
          <mat-icon class="text-teal-600">verified</mat-icon>
          <div>
            <span class="font-bold text-teal-900 dark:text-teal-200">Période d'Essai Gratuite de 14 jours active.</span>
            <span class="text-teal-700 dark:text-teal-400 ml-1">
              Profitez de toutes les fonctionnalités avancées sans engagement.
            </span>
          </div>
        </div>
        <span class="font-mono font-bold text-teal-800 dark:text-teal-300">
          Valable jusqu'au 31 Oct 2026
        </span>
      </div>
    </div>
  `,
})
export class SubscriptionComponent {
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);
  readonly tenantService = inject(TenantService);

  readonly isYearly = signal<boolean>(false);
  readonly currency = signal<'MAD' | 'EUR'>('MAD');

  getPrice(plan: SubscriptionPlan): string {
    if (this.currency() === 'EUR') {
      const amount = this.isYearly() ? plan.yearlyFeeEUR : plan.monthlyFeeEUR;
      return `${amount} €`;
    }
    const amount = this.isYearly() ? plan.yearlyFeeMAD : plan.monthlyFeeMAD;
    return `${amount} MAD`;
  }
}
