import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../auth/session.service';

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
    try {
      await this.sessions.signOut();
    } finally {
      this.signingOut.set(false);
      await this.router.navigateByUrl('/sign-in');
    }
  }
}
