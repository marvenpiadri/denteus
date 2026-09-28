import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopbarComponent } from './core/components/topbar.component';
import { NavigationTab, SidebarComponent } from './core/components/sidebar.component';
import { HomeLandingComponent } from './features/home/home-landing.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { WaitingRoomComponent } from './features/waiting-room/waiting-room.component';
import { AgendaComponent } from './features/agenda/agenda.component';
import { PatientListComponent } from './features/patients/patient-list.component';
import { PatientDetailComponent } from './features/patients/patient-detail.component';
import { ProceduresComponent } from './features/procedures/procedures.component';
import { ReportsComponent } from './features/reports/reports.component';
import { ClinicSettingsComponent } from './features/clinic-settings/clinic-settings.component';
import { SubscriptionComponent } from './features/subscription/subscription.component';
import { AuditTrailComponent } from './features/audit/audit-trail.component';
import { DentalDataService } from './core/services/dental-data.service';
import { I18nService } from './core/services/i18n.service';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    TopbarComponent,
    SidebarComponent,
    HomeLandingComponent,
    DashboardComponent,
    WaitingRoomComponent,
    AgendaComponent,
    PatientListComponent,
    PatientDetailComponent,
    ProceduresComponent,
    ReportsComponent,
    ClinicSettingsComponent,
    SubscriptionComponent,
    AuditTrailComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);

  readonly activeTab = signal<NavigationTab>('home');
  readonly viewingPatientDetail = signal<boolean>(false);
  readonly mobileMenuOpen = signal<boolean>(false);
  readonly sidebarExpanded = signal<boolean>(true);

  toggleSidebar(): void {
    this.sidebarExpanded.update((v) => !v);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  onTabChange(tab: NavigationTab): void {
    this.activeTab.set(tab);
    if (tab !== 'patients') {
      this.viewingPatientDetail.set(false);
    }
    this.mobileMenuOpen.set(false);
  }

  onPatientSelected(patientId: string): void {
    this.dataService.selectPatient(patientId);
    this.activeTab.set('patients');
    this.viewingPatientDetail.set(true);
    this.mobileMenuOpen.set(false);
  }
}
