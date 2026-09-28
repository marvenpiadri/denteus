import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../services/i18n.service';
import { DentalDataService } from '../services/dental-data.service';

export type NavigationTab =
  | 'home'
  | 'dashboard'
  | 'waiting-room'
  | 'agenda'
  | 'patients'
  | 'procedures'
  | 'reports'
  | 'clinic-settings'
  | 'subscription'
  | 'audit-trail';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside
      [class.w-64]="expanded()"
      [class.w-18]="!expanded()"
      class="bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col justify-between shrink-0 transition-all duration-300 h-[calc(100vh-4rem)] sticky top-16 select-none overflow-hidden">

      <!-- Navigation Content -->
      <div class="p-2 space-y-1 overflow-y-auto overflow-x-hidden">
        <!-- Site Public / Accueil link -->
        <button
          type="button"
          (click)="onSelectTab('home')"
          [title]="expanded() ? '' : 'Accueil & Présentation'"
          [class.bg-teal-50]="activeTab() === 'home'"
          [class.text-teal-700]="activeTab() === 'home'"
          [class.dark:bg-teal-950/70]="activeTab() === 'home'"
          [class.dark:text-teal-300]="activeTab() === 'home'"
          [class.text-neutral-700]="activeTab() !== 'home'"
          [class.dark:text-neutral-300]="activeTab() !== 'home'"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          [class.justify-center]="!expanded()">
          <mat-icon class="text-sm shrink-0" style="font-size: 18px; width: 18px; height: 18px;">home</mat-icon>
          @if (expanded()) {
            <span class="truncate">Accueil & Démo</span>
          }
        </button>

        <div class="my-1 border-t border-neutral-100 dark:border-neutral-800"></div>

        <!-- Section 1: Pratique Clinique -->
        @if (expanded()) {
          <div class="px-3 pt-2 pb-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider truncate">
            Pratique Clinique
          </div>
        }

        <!-- Dashboard -->
        <button
          type="button"
          (click)="onSelectTab('dashboard')"
          [title]="expanded() ? '' : i18n.dict().dashboard"
          [class.bg-teal-50]="activeTab() === 'dashboard'"
          [class.text-teal-700]="activeTab() === 'dashboard'"
          [class.dark:bg-teal-950/70]="activeTab() === 'dashboard'"
          [class.dark:text-teal-300]="activeTab() === 'dashboard'"
          [class.text-neutral-700]="activeTab() !== 'dashboard'"
          [class.dark:text-neutral-300]="activeTab() !== 'dashboard'"
          class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          [class.justify-center]="!expanded()">
          <div class="flex items-center gap-2.5 min-w-0">
            <mat-icon class="text-sm shrink-0" style="font-size: 18px; width: 18px; height: 18px;">dashboard</mat-icon>
            @if (expanded()) {
              <span class="truncate">{{ i18n.dict().dashboard }}</span>
            }
          </div>
        </button>

        <!-- Waiting Room -->
        <button
          type="button"
          (click)="onSelectTab('waiting-room')"
          [title]="expanded() ? '' : i18n.dict().waitingRoom + ' (' + dataService.liveFlowWaiting().length + ')'"
          [class.bg-teal-50]="activeTab() === 'waiting-room'"
          [class.text-teal-700]="activeTab() === 'waiting-room'"
          [class.dark:bg-teal-950/70]="activeTab() === 'waiting-room'"
          [class.dark:text-teal-300]="activeTab() === 'waiting-room'"
          [class.text-neutral-700]="activeTab() !== 'waiting-room'"
          [class.dark:text-neutral-300]="activeTab() !== 'waiting-room'"
          class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors relative"
          [class.justify-center]="!expanded()">
          <div class="flex items-center gap-2.5 min-w-0 relative">
            <mat-icon class="text-sm shrink-0" style="font-size: 18px; width: 18px; height: 18px;">meeting_room</mat-icon>
            @if (!expanded() && dataService.liveFlowWaiting().length > 0) {
              <span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-neutral-900"></span>
            }
            @if (expanded()) {
              <span class="truncate">{{ i18n.dict().waitingRoom }}</span>
            }
          </div>
          @if (expanded() && dataService.liveFlowWaiting().length > 0) {
            <span class="px-1.5 py-0.5 text-[10px] font-bold font-mono bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded-md">
              {{ dataService.liveFlowWaiting().length }}
            </span>
          }
        </button>

        <!-- Agenda -->
        <button
          type="button"
          (click)="onSelectTab('agenda')"
          [title]="expanded() ? '' : i18n.dict().agenda"
          [class.bg-teal-50]="activeTab() === 'agenda'"
          [class.text-teal-700]="activeTab() === 'agenda'"
          [class.dark:bg-teal-950/70]="activeTab() === 'agenda'"
          [class.dark:text-teal-300]="activeTab() === 'agenda'"
          [class.text-neutral-700]="activeTab() !== 'agenda'"
          [class.dark:text-neutral-300]="activeTab() !== 'agenda'"
          class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          [class.justify-center]="!expanded()">
          <div class="flex items-center gap-2.5 min-w-0">
            <mat-icon class="text-sm shrink-0" style="font-size: 18px; width: 18px; height: 18px;">calendar_month</mat-icon>
            @if (expanded()) {
              <span class="truncate">{{ i18n.dict().agenda }}</span>
            }
          </div>
          @if (expanded()) {
            <span class="px-1.5 py-0.5 text-[10px] font-bold font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-md">
              {{ dataService.todayAppointments().length }}
            </span>
          }
        </button>

        <!-- Patients & Odontogram -->
        <button
          type="button"
          (click)="onSelectTab('patients')"
          [title]="expanded() ? '' : i18n.dict().patients"
          [class.bg-teal-50]="activeTab() === 'patients'"
          [class.text-teal-700]="activeTab() === 'patients'"
          [class.dark:bg-teal-950/70]="activeTab() === 'patients'"
          [class.dark:text-teal-300]="activeTab() === 'patients'"
          [class.text-neutral-700]="activeTab() !== 'patients'"
          [class.dark:text-neutral-300]="activeTab() !== 'patients'"
          class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          [class.justify-center]="!expanded()">
          <div class="flex items-center gap-2.5 min-w-0">
            <mat-icon class="text-sm shrink-0" style="font-size: 18px; width: 18px; height: 18px;">badge</mat-icon>
            @if (expanded()) {
              <span class="truncate">{{ i18n.dict().patients }}</span>
            }
          </div>
          @if (expanded()) {
            <span class="text-[10px] font-mono text-neutral-400">
              {{ dataService.patients().length }}
            </span>
          }
        </button>

        <!-- Section 2: Gestion & Administration -->
        @if (expanded()) {
          <div class="pt-4 px-3 pb-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider truncate">
            Gestion & Administration
          </div>
        } @else {
          <div class="my-2 border-t border-neutral-100 dark:border-neutral-800"></div>
        }

        <!-- Procedures / CCAM -->
        <button
          type="button"
          (click)="onSelectTab('procedures')"
          [title]="expanded() ? '' : i18n.dict().procedures"
          [class.bg-teal-50]="activeTab() === 'procedures'"
          [class.text-teal-700]="activeTab() === 'procedures'"
          [class.dark:bg-teal-950/70]="activeTab() === 'procedures'"
          [class.dark:text-teal-300]="activeTab() === 'procedures'"
          [class.text-neutral-700]="activeTab() !== 'procedures'"
          [class.dark:text-neutral-300]="activeTab() !== 'procedures'"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          [class.justify-center]="!expanded()">
          <mat-icon class="text-sm shrink-0" style="font-size: 18px; width: 18px; height: 18px;">receipt_long</mat-icon>
          @if (expanded()) {
            <span class="truncate">{{ i18n.dict().procedures }}</span>
          }
        </button>

        <!-- Reports -->
        <button
          type="button"
          (click)="onSelectTab('reports')"
          [title]="expanded() ? '' : i18n.dict().reports"
          [class.bg-teal-50]="activeTab() === 'reports'"
          [class.text-teal-700]="activeTab() === 'reports'"
          [class.dark:bg-teal-950/70]="activeTab() === 'reports'"
          [class.dark:text-teal-300]="activeTab() === 'reports'"
          [class.text-neutral-700]="activeTab() !== 'reports'"
          [class.dark:text-neutral-300]="activeTab() !== 'reports'"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          [class.justify-center]="!expanded()">
          <mat-icon class="text-sm shrink-0" style="font-size: 18px; width: 18px; height: 18px;">analytics</mat-icon>
          @if (expanded()) {
            <span class="truncate">{{ i18n.dict().reports }}</span>
          }
        </button>

        <!-- Clinic Settings -->
        <button
          type="button"
          (click)="onSelectTab('clinic-settings')"
          [title]="expanded() ? '' : i18n.dict().clinicSettings"
          [class.bg-teal-50]="activeTab() === 'clinic-settings'"
          [class.text-teal-700]="activeTab() === 'clinic-settings'"
          [class.dark:bg-teal-950/70]="activeTab() === 'clinic-settings'"
          [class.dark:text-teal-300]="activeTab() === 'clinic-settings'"
          [class.text-neutral-700]="activeTab() !== 'clinic-settings'"
          [class.dark:text-neutral-300]="activeTab() !== 'clinic-settings'"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          [class.justify-center]="!expanded()">
          <mat-icon class="text-sm shrink-0" style="font-size: 18px; width: 18px; height: 18px;">settings</mat-icon>
          @if (expanded()) {
            <span class="truncate">{{ i18n.dict().clinicSettings }}</span>
          }
        </button>

        <!-- Audit Trail -->
        <button
          type="button"
          (click)="onSelectTab('audit-trail')"
          [title]="expanded() ? '' : i18n.dict().auditTrail"
          [class.bg-teal-50]="activeTab() === 'audit-trail'"
          [class.text-teal-700]="activeTab() === 'audit-trail'"
          [class.dark:bg-teal-950/70]="activeTab() === 'audit-trail'"
          [class.dark:text-teal-300]="activeTab() === 'audit-trail'"
          [class.text-neutral-700]="activeTab() !== 'audit-trail'"
          [class.dark:text-neutral-300]="activeTab() !== 'audit-trail'"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          [class.justify-center]="!expanded()">
          <mat-icon class="text-sm shrink-0" style="font-size: 18px; width: 18px; height: 18px;">security</mat-icon>
          @if (expanded()) {
            <span class="truncate">{{ i18n.dict().auditTrail }}</span>
          }
        </button>
      </div>

      <!-- Bottom Controls: Subscription & Collapse / Expand toggle -->
      <div class="p-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
        <!-- SaaS Subscription Card -->
        @if (expanded()) {
          <button
            type="button"
            (click)="onSelectTab('subscription')"
            class="w-full text-left p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 hover:border-teal-500 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-neutral-900 dark:text-white">Denteus Clinique</span>
              <span class="text-[10px] font-semibold text-teal-600 dark:text-teal-400">Actif</span>
            </div>
            <div class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              4 Fauteuils · Cloud HDS
            </div>
            <div class="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-teal-600 dark:text-teal-400">
              <span>Gérer l'offre</span>
              <mat-icon class="text-xs" style="font-size: 14px; width: 14px; height: 14px;">arrow_forward</mat-icon>
            </div>
          </button>
        } @else {
          <button
            type="button"
            (click)="onSelectTab('subscription')"
            title="Abonnement Denteus Clinique (Actif)"
            class="w-full flex items-center justify-center p-2 rounded-xl text-teal-600 dark:text-teal-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <mat-icon style="font-size: 20px; width: 20px; height: 20px;">workspace_premium</mat-icon>
          </button>
        }

        <!-- Toggle Collapse/Expand Button -->
        <button
          type="button"
          (click)="toggleExpanded.emit()"
          [title]="expanded() ? 'Réduire la navigation' : 'Agrandir la navigation'"
          class="w-full flex items-center py-2 px-2.5 rounded-xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          [class.justify-between]="expanded()"
          [class.justify-center]="!expanded()">
          <div class="flex items-center gap-2">
            <mat-icon style="font-size: 18px; width: 18px; height: 18px;">
              {{ expanded() ? 'first_page' : 'last_page' }}
            </mat-icon>
            @if (expanded()) {
              <span class="text-xs font-medium">Réduire le menu</span>
            }
          </div>
          @if (expanded()) {
            <span class="text-[10px] font-mono text-neutral-400">Ctrl+[</span>
          }
        </button>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);

  readonly activeTab = input<NavigationTab>('dashboard');
  readonly expanded = input<boolean>(true);

  readonly tabChange = output<NavigationTab>();
  readonly toggleExpanded = output<void>();

  onSelectTab(tab: NavigationTab): void {
    this.tabChange.emit(tab);
  }
}
