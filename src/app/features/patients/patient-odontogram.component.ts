import { AfterViewInit, ChangeDetectionStrategy, Component, OnChanges, OnDestroy, PLATFORM_ID, SimpleChanges, computed, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { OdontogramShellComponent, type OdontogramThemeConfig } from 'angular-advanced-odontogram';
import { OdontogramPersistenceService } from '../../core/services/odontogram-persistence.service';

@Component({
  selector: 'app-patient-odontogram',
  imports: [OdontogramShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="odontogram-workspace">
      <div class="odontogram-heading">
        <div>
          <p class="odontogram-eyebrow">Dossier clinique</p>
          <h2>Odontogramme</h2>
          <p>Etat clinique, plan de soins et informations dentaires du patient.</p>
        </div>
        <span class="odontogram-badge">FDI</span>
      </div>
      @if (isBrowser) {
        <div class="odontogram-shell">
          <aao-odontogram-shell
            language="fr"
            [numberingSystem]="numberingSystem()"
            [darkMode]="darkMode()"
            [themeConfig]="themeConfig()"
            [showStatusCard]="true"
            [showOrthoCard]="true"
            [enableNotes]="true"
            [enableIcdas]="true" />
        </div>
      } @else {
        <div class="odontogram-loading" aria-hidden="true">
          <span>Chargement de l'odontogramme clinique...</span>
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .odontogram-workspace {
      overflow: hidden;
      border: 1px solid var(--surface-border, #e2e8f0);
      border-radius: 1rem;
      background: var(--surface-card, #ffffff);
      box-shadow: 0 8px 30px rgb(15 23 42 / 0.05);
    }
    .odontogram-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--surface-border, #e2e8f0);
      background: color-mix(in srgb, var(--surface-card, #fff) 94%, var(--color-primary, #0d9488));
    }
    .odontogram-eyebrow {
      margin: 0 0 .2rem;
      color: var(--color-primary, #0d9488);
      font-size: .68rem;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    h2 { margin: 0; color: var(--text-primary, #0f172a); font-size: 1rem; font-weight: 750; }
    .odontogram-heading p:last-child { margin: .2rem 0 0; color: var(--text-muted, #64748b); font-size: .75rem; }
    .odontogram-badge {
      flex: 0 0 auto;
      padding: .35rem .6rem;
      border: 1px solid color-mix(in srgb, var(--color-primary, #0d9488) 30%, transparent);
      border-radius: .55rem;
      background: color-mix(in srgb, var(--color-primary, #0d9488) 9%, transparent);
      color: var(--color-primary, #0d9488);
      font: 700 .68rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .odontogram-shell { min-height: 500px; padding: .75rem; background: var(--surface-card, #ffffff); }
    .odontogram-loading {
      display: flex; min-height: 500px; align-items: center; justify-content: center;
      gap: .6rem; color: var(--text-muted, #64748b); font-size: .75rem;
    }
    .odontogram-spinner {
      width: 1.1rem; height: 1.1rem; border: 2px solid color-mix(in srgb, var(--color-primary, #0d9488) 20%, transparent);
      border-top-color: var(--color-primary, #0d9488); border-radius: 999px; animation: odontogram-spin .7s linear infinite;
    }
    @keyframes odontogram-spin { to { transform: rotate(360deg); } }
  `],
})
export class PatientOdontogramComponent implements AfterViewInit, OnChanges, OnDestroy {
  readonly patientId = input.required<string>();
  readonly organizationId = input.required<string>();
  readonly clinicId = input.required<string>();
  readonly updatedBy = input.required<string>();
  readonly numberingSystem = input<'FDI' | 'UNIVERSAL' | 'PALMER'>('FDI');
  readonly darkMode = input(false);

  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly persistence = inject(OdontogramPersistenceService);
  private viewReady = false;

  readonly themeConfig = computed<OdontogramThemeConfig>(() => this.darkMode()
    ? { colors: { background: '#090d16', panel: '#0f172a', card: '#111827', text: '#f8fafc', muted: '#94a3b8', line: '#1e293b', accent: '#14b8a6', accent2: '#2dd4bf' } }
    : { colors: { background: '#f8fafc', panel: '#ffffff', card: '#ffffff', text: '#0f172a', muted: '#64748b', line: '#e2e8f0', accent: '#0d9488', accent2: '#0f766e' } });

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.viewReady = true;
    void this.attachPersistence();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady || !this.isBrowser) return;
    if (changes['patientId'] || changes['organizationId'] || changes['clinicId'] || changes['updatedBy']) {
      void this.attachPersistence();
    }
  }

  private attachPersistence(): Promise<void> {
    return this.persistence.attach(this.patientId(), this.organizationId(), this.clinicId(), this.updatedBy());
  }

  ngOnDestroy(): void {
    this.persistence.detach();
  }
}
