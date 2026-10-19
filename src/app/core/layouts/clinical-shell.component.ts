import { isPlatformBrowser } from '@angular/common';
import { ElementRef, ViewChild } from '@angular/core';
import { ChangeDetectionStrategy, Component, HostListener, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
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

  @ViewChild('mobileMenuButton') private mobileMenuButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('mobileSidebar') private mobileSidebar?: ElementRef<HTMLElement>;

  readonly mobileNavigationOpen = signal(false);
  readonly sidebarCollapsed = signal(false);
  readonly isMobileViewport = signal(false);
  readonly theme = signal<'light' | 'dark'>('light');
  readonly signingOut = signal(false);
  readonly signOutError = signal('');

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobileViewport.set(window.matchMedia('(max-width: 860px)').matches);
      let theme: 'light' | 'dark' = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      try {
        const savedTheme = localStorage.getItem('dentaleus-theme');
        if (savedTheme === 'light' || savedTheme === 'dark') theme = savedTheme;
      } catch {
        // Keep the current document theme when browser storage is unavailable.
      }
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
      try {
        localStorage.setItem('dentaleus-theme', next);
      } catch {
        // Theme remains usable for this page even when storage is blocked.
      }
    }
  }

  selectClinic(clinicId: string): void {
    this.tenantContext.setActiveClinic(clinicId || null);
  }

  get userInitial(): string {
    const name = this.sessions.user()?.name || this.sessions.user()?.email || 'D';
    return name.trim().charAt(0).toUpperCase() || 'D';
  }

  @HostListener('window:resize')
  onViewportResize(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const isMobile = window.matchMedia('(max-width: 860px)').matches;
    this.isMobileViewport.set(isMobile);
    if (!isMobile) this.mobileNavigationOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.mobileNavigationOpen()) this.closeMobileNavigation();
  }

  onSidebarKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.isMobileViewport() || !this.mobileNavigationOpen()) return;
    const sidebar = this.mobileSidebar?.nativeElement;
    if (!sidebar) return;
    const focusable = Array.from(sidebar.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) =>
      element.getClientRects().length > 0
      && !element.hasAttribute('inert')
      && element.getAttribute('aria-hidden') !== 'true',
    );
    if (!focusable.length) {
      event.preventDefault();
      sidebar.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  closeMobileNavigation(): void {
    const wasOpen = this.mobileNavigationOpen();
    this.mobileNavigationOpen.set(false);
    if (wasOpen && this.isMobileViewport()) {
      queueMicrotask(() => this.mobileMenuButton?.nativeElement.focus());
    }
  }

  toggleMobileNavigation(): void {
    if (this.mobileNavigationOpen()) {
      this.closeMobileNavigation();
      return;
    }
    this.mobileNavigationOpen.set(true);
    queueMicrotask(() => {
      if (!this.mobileNavigationOpen() || !this.isMobileViewport()) return;
      this.mobileSidebar?.nativeElement.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled])',
      )?.focus();
    });
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
