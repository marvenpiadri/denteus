import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../auth/session.service';
import { TenantContextService } from '../tenant/tenant-context.service';

@Component({
  selector: 'app-clinical-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clinical-shell.component.html',
  styleUrl: './clinical-shell.component.css',
})
export class ClinicalShellComponent implements OnInit {
  readonly sessions = inject(SessionService);
  readonly tenantContext = inject(TenantContextService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  readonly mobileNavigationOpen = signal(false);
  readonly theme = signal<'light' | 'dark'>('light');
  readonly signingOut = signal(false);
  readonly signOutError = signal('');

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('dentaleus-theme');
      const theme = savedTheme === 'dark' ? 'dark' : 'light';
      this.theme.set(theme);
      document.documentElement.setAttribute('data-theme', theme);
      // Clear any previously rendered tenant data before resolving this session's access.
      this.tenantContext.organizations.set([]);
      void this.tenantContext.load(true);
    }
  }

  toggleTheme(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('dentaleus-theme', next);
    }
  }

  selectClinic(clinicId: string): void {
    this.tenantContext.setActiveClinic(clinicId || null);
  }

  get userInitial(): string {
    const name = this.sessions.user()?.name || this.sessions.user()?.email || 'D';
    return name.trim().charAt(0).toUpperCase() || 'D';
  }

  closeMobileNavigation(): void {
    this.mobileNavigationOpen.set(false);
  }

  toggleMobileNavigation(): void {
    this.mobileNavigationOpen.update((open) => !open);
  }

  async signOut(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    this.signOutError.set('');
    try {
      await this.sessions.signOut();
      this.tenantContext.organizations.set([]);
      this.tenantContext.setActiveClinic(null);
      await this.router.navigateByUrl('/sign-in');
    } catch {
      this.signOutError.set('La déconnexion n’a pas pu être confirmée par le serveur. Votre session reste affichée comme active.');
    } finally {
      this.signingOut.set(false);
    }
  }
}
