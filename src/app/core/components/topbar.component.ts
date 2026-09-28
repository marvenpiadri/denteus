import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../services/i18n.service';
import { ThemeService } from '../services/theme.service';
import { TenantService } from '../services/tenant.service';
import { DentalDataService } from '../services/dental-data.service';
import { Patient } from '../models/patient.models';

@Component({
  selector: 'app-topbar',
  imports: [CommonModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="h-16 px-4 md:px-6 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4 sticky top-0 z-30 transition-colors">
      <!-- Zone 1: Brand & Tenant Switcher -->
      <div class="flex items-center gap-3 shrink-0">
        <!-- Mobile Menu Trigger -->
        <button
          type="button"
          (click)="openMobileMenu.emit()"
          class="md:hidden p-1.5 -ml-1 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title="Menu">
          <mat-icon style="font-size: 22px; width: 22px; height: 22px;">menu</mat-icon>
        </button>

        <!-- Desktop Sidebar Toggle Trigger (Close / Expand) -->
        <button
          type="button"
          (click)="toggleSidebar.emit()"
          class="hidden md:flex p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          [title]="sidebarExpanded() ? 'Réduire la barre latérale' : 'Agrandir la barre latérale'">
          <mat-icon style="font-size: 20px; width: 20px; height: 20px;">
            {{ sidebarExpanded() ? 'menu_open' : 'menu' }}
          </mat-icon>
        </button>

        <button
          type="button"
          (click)="navigateHome.emit()"
          title="Retourner à l'Accueil / Présentation"
          class="flex items-center gap-2 hover:opacity-85 transition-opacity text-left cursor-pointer">
          <div class="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            D
          </div>
          <span class="text-lg font-bold tracking-tight text-neutral-900 dark:text-white hidden sm:inline">
            Denteus
          </span>
        </button>

        <div class="h-5 w-px bg-neutral-200 dark:bg-neutral-800 mx-1 hidden md:block"></div>

        <!-- Organization & Clinic Switcher -->
        <div class="relative">
          <button
            (click)="toggleClinicDropdown()"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 transition-colors">
            <mat-icon class="text-teal-600 dark:text-teal-400 text-sm" style="font-size: 16px; width: 16px; height: 16px;">local_hospital</mat-icon>
            <span class="max-w-[140px] lg:max-w-[180px] truncate font-semibold">{{ tenantService.currentClinic().name }}</span>
            <mat-icon class="text-neutral-400 text-xs" style="font-size: 14px; width: 14px; height: 14px;">expand_more</mat-icon>
          </button>

          @if (showClinicDropdown()) {
            <div
              class="absolute left-0 top-full mt-1.5 w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg p-2 z-50 animate-in fade-in zoom-in-95">
              <div class="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-2 py-1">
                {{ tenantService.currentOrganization().name }}
              </div>
              <div class="space-y-1 mt-1">
                @for (clinic of tenantService.availableClinics(); track clinic.id) {
                  <button
                    (click)="selectClinic(clinic.id)"
                    class="w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors"
                    [class.bg-teal-50]="clinic.id === tenantService.currentClinicId()"
                    [class.text-teal-700]="clinic.id === tenantService.currentClinicId()"
                    [class.dark:bg-teal-950]="clinic.id === tenantService.currentClinicId()"
                    [class.dark:text-teal-300]="clinic.id === tenantService.currentClinicId()"
                    [class.text-neutral-700]="clinic.id !== tenantService.currentClinicId()"
                    [class.dark:text-neutral-300]="clinic.id !== tenantService.currentClinicId()"
                    [class.hover:bg-neutral-100]="clinic.id !== tenantService.currentClinicId()"
                    [class.dark:hover:bg-neutral-800]="clinic.id !== tenantService.currentClinicId()">
                    <div>
                      <div class="font-medium">{{ clinic.name }}</div>
                      <div class="text-[10px] text-neutral-400">{{ clinic.city }} · {{ clinic.chairs.length }} fauteuils</div>
                    </div>
                    @if (clinic.id === tenantService.currentClinicId()) {
                      <mat-icon class="text-teal-600 dark:text-teal-400 text-xs" style="font-size: 16px; width: 16px; height: 16px;">check</mat-icon>
                    }
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Zone 2: Fast Patient Search -->
      <div class="flex-1 max-w-md relative hidden md:block">
        <div class="relative">
          <mat-icon class="absolute left-3 top-2.5 text-neutral-400 text-sm" style="font-size: 18px; width: 18px; height: 18px;">search</mat-icon>
          <input
            #searchInput
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearchInput($event)"
            [placeholder]="i18n.dict().searchPlaceholder"
            class="w-full pl-9 pr-12 py-1.5 text-xs bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-teal-500 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all" />
          <kbd class="absolute right-2.5 top-2 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 bg-neutral-200 dark:bg-neutral-700 rounded border border-neutral-300 dark:border-neutral-600">
            /
          </kbd>
        </div>

        <!-- Search Results Dropdown -->
        @if (searchResults().length > 0 && searchQuery().trim()) {
          <div class="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl p-1.5 z-50 max-h-80 overflow-y-auto">
            @for (patient of searchResults(); track patient.id) {
              <button
                (click)="onSelectSearchResult(patient)"
                class="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors">
                <div class="flex items-center gap-2.5">
                  <div class="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs">
                    {{ patient.firstName.charAt(0) }}{{ patient.lastName.charAt(0) }}
                  </div>
                  <div>
                    <div class="font-semibold text-neutral-900 dark:text-white">
                      {{ patient.firstName }} {{ patient.lastName }}
                    </div>
                    <div class="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {{ patient.patientNumber }} · {{ patient.phone }} · CIN: {{ patient.cin }}
                    </div>
                  </div>
                </div>
                @if (patient.balanceDue > 0) {
                  <span class="text-[11px] font-mono font-medium text-amber-600 dark:text-amber-400">
                    {{ i18n.formatCurrency(patient.balanceDue) }}
                  </span>
                }
              </button>
            }
          </div>
        }
      </div>

      <!-- Zone 3: Actions, Language, Theme & Profile -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Locale Switcher -->
        <div class="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-800 p-0.5 bg-neutral-100 dark:bg-neutral-800">
          <button
            (click)="setLocale('fr')"
            [class.bg-white]="i18n.currentLocale() === 'fr'"
            [class.dark:bg-neutral-700]="i18n.currentLocale() === 'fr'"
            [class.shadow-sm]="i18n.currentLocale() === 'fr'"
            class="px-2 py-1 text-[11px] font-semibold rounded text-neutral-700 dark:text-neutral-200 transition-colors">
            FR
          </button>
          <button
            (click)="setLocale('en')"
            [class.bg-white]="i18n.currentLocale() === 'en'"
            [class.dark:bg-neutral-700]="i18n.currentLocale() === 'en'"
            [class.shadow-sm]="i18n.currentLocale() === 'en'"
            class="px-2 py-1 text-[11px] font-semibold rounded text-neutral-700 dark:text-neutral-200 transition-colors">
            EN
          </button>
          <button
            (click)="setLocale('ar')"
            [class.bg-white]="i18n.currentLocale() === 'ar'"
            [class.dark:bg-neutral-700]="i18n.currentLocale() === 'ar'"
            [class.shadow-sm]="i18n.currentLocale() === 'ar'"
            class="px-2 py-1 text-[11px] font-semibold rounded text-neutral-700 dark:text-neutral-200 transition-colors">
            عربي
          </button>
        </div>

        <!-- Dark/Light Theme Toggle -->
        <button
          (click)="themeService.toggleTheme()"
          [title]="themeService.isDark() ? 'Activer le mode clair' : 'Activer le mode sombre'"
          class="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          @if (themeService.isDark()) {
            <mat-icon class="text-sm" style="font-size: 18px; width: 18px; height: 18px;">light_mode</mat-icon>
          } @else {
            <mat-icon class="text-sm" style="font-size: 18px; width: 18px; height: 18px;">dark_mode</mat-icon>
          }
        </button>

        <!-- Current User Profile Chip -->
        <div class="flex items-center gap-2 pl-2 border-l border-neutral-200 dark:border-neutral-800">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm"
            [style.backgroundColor]="tenantService.currentUser().color">
            {{ tenantService.currentUser().name.split(' ').pop()?.charAt(0) }}
          </div>
          <div class="hidden xl:block text-left">
            <div class="text-xs font-semibold text-neutral-900 dark:text-white leading-tight">
              {{ tenantService.currentUser().name }}
            </div>
            <div class="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">
              {{ tenantService.currentUser().specialty || tenantService.currentUser().role }}
            </div>
          </div>
        </div>
      </div>
    </header>
  `,
})
export class TopbarComponent {
  readonly i18n = inject(I18nService);
  readonly themeService = inject(ThemeService);
  readonly tenantService = inject(TenantService);
  readonly dataService = inject(DentalDataService);

  readonly sidebarExpanded = input<boolean>(true);
  readonly selectPatient = output<string>();
  readonly openMobileMenu = output<void>();
  readonly toggleSidebar = output<void>();
  readonly navigateHome = output<void>();

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  readonly showClinicDropdown = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  readonly searchResults = signal<Patient[]>([]);

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      event.preventDefault();
      this.searchInputRef?.nativeElement.focus();
    }
  }

  toggleClinicDropdown(): void {
    this.showClinicDropdown.update((v) => !v);
  }

  selectClinic(clinicId: string): void {
    this.tenantService.switchClinic(clinicId);
    this.showClinicDropdown.set(false);
  }

  setLocale(locale: 'fr' | 'en' | 'ar'): void {
    this.i18n.setLocale(locale);
  }

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    if (!query.trim()) {
      this.searchResults.set([]);
    } else {
      this.searchResults.set(this.dataService.searchPatients(query).slice(0, 6));
    }
  }

  onSelectSearchResult(patient: Patient): void {
    this.dataService.selectPatient(patient.id);
    this.selectPatient.emit(patient.id);
    this.searchQuery.set('');
    this.searchResults.set([]);
  }
}
