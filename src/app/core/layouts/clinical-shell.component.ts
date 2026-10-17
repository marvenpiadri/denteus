import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
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
export class ClinicalShellComponent {
  readonly sessions = inject(SessionService);
  private readonly router = inject(Router);

  readonly mobileNavigationOpen = signal(false);
  readonly signingOut = signal(false);
  readonly signOutError = signal('');

  ngOnInit(): void {\n    if (isPlatformBrowser(this.platformId)) void this.tenantContext.load();\n  }\n\n  selectClinic(clinicId: string): void {\n    this.tenantContext.setActiveClinic(clinicId || null);\n  }\n\n  get userInitial(): string {
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
      await this.router.navigateByUrl('/sign-in');
    } catch {
      this.signOutError.set('La déconnexion n’a pas pu être confirmée par le serveur. Votre session reste affichée comme active.');
    } finally {
      this.signingOut.set(false);
    }
  }
}
