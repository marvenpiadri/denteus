import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PatientWorkspaceTab } from './patient-detail.component';

@Component({
  selector: 'app-patient-workspace-tabs',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="flex items-center gap-1 border-t border-neutral-200 dark:border-neutral-800 pt-3 overflow-x-auto" aria-label="Navigation du dossier patient">
      @for (tab of tabs; track tab.id) {
        <button
          type="button"
          (click)="tabChange.emit(tab.id)"
          [class.bg-teal-50]="activeTab() === tab.id"
          [class.text-teal-700]="activeTab() === tab.id"
          [class.dark:bg-teal-950/70]="activeTab() === tab.id"
          [class.dark:text-teal-300]="activeTab() === tab.id"
          [class.text-neutral-600]="activeTab() !== tab.id"
          [class.dark:text-neutral-400]="activeTab() !== tab.id"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5">
          <mat-icon class="text-xs" style="font-size: 16px; width: 16px; height: 16px;">{{ tab.icon }}</mat-icon>
          <span>{{ tab.label }}</span>
          @if (tab.count !== undefined) {
            <span class="text-[10px] opacity-70">({{ tab.count }})</span>
          }
        </button>
      }
    </nav>
  `,
})
export class PatientWorkspaceTabsComponent {
  readonly activeTab = input.required<PatientWorkspaceTab>();
  readonly periodontalCount = input(0);
  readonly treatmentCount = input(0);
  readonly notesCount = input(0);

  readonly tabChange = output<PatientWorkspaceTab>();

  readonly tabs = [
    { id: 'overview' as const, label: "Vue d'ensemble", icon: 'info' },
    { id: 'odontogram' as const, label: 'Odontogramme', icon: 'view_module' },
    { id: 'periodontal' as const, label: 'Parodontal', icon: 'water_drop', get count() { return 0; } },
    { id: 'treatment' as const, label: 'Plans de traitement', icon: 'receipt', get count() { return 0; } },
    { id: 'notes' as const, label: 'Notes cliniques', icon: 'edit_note', get count() { return 0; } },
    { id: 'documents' as const, label: 'Radios & documents', icon: 'image' },
    { id: 'billing' as const, label: 'Facturation', icon: 'account_balance_wallet' },
  ];

  getCount(tab: PatientWorkspaceTab): number | undefined {
    if (tab === 'periodontal') return this.periodontalCount();
    if (tab === 'treatment') return this.treatmentCount();
    if (tab === 'notes') return this.notesCount();
    return undefined;
  }
}
