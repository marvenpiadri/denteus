import { AfterViewInit, ChangeDetectionStrategy, Component, OnChanges, OnDestroy, PLATFORM_ID, SimpleChanges, computed, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { OdontogramShellComponent, type OdontogramThemeConfig } from 'angular-advanced-odontogram';
import { OdontogramPersistenceService } from '../../core/services/odontogram-persistence.service';

@Component({
  selector: 'app-patient-odontogram',
  imports: [OdontogramShellComponent],
  templateUrl: './patient-odontogram.component.html',
  styleUrl: './patient-odontogram.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  readonly workingTeeth = computed(() => {
    const teeth = new Set<number>();

    for (const change of this.persistence.planChanges()) {
      if (change.toothNo > 0) teeth.add(change.toothNo);
    }

    return [...teeth].sort((a, b) => a - b);
  });

  readonly themeConfig = computed<OdontogramThemeConfig>(() => this.darkMode()
    ? {
        colors: {
          background: '#090d16',
          panel: '#0f172a',
          card: '#111827',
          text: '#f8fafc',
          muted: '#94a3b8',
          line: '#1e293b',
          accent: '#14b8a6',
          accent2: '#2dd4bf',
        },
      }
    : {
        colors: {
          background: '#f8fafc',
          panel: '#ffffff',
          card: '#ffffff',
          text: '#0f172a',
          muted: '#64748b',
          line: '#e2e8f0',
          accent: '#0d9488',
          accent2: '#0f766e',
        },
      });

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
    return this.persistence.attach(
      this.patientId(),
      this.organizationId(),
      this.clinicId(),
      this.updatedBy(),
    );
  }

  ngOnDestroy(): void {
    this.persistence.detach();
  }
}
