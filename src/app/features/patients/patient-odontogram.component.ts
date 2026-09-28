import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { OdontogramShellComponent } from 'angular-advanced-odontogram';
@Component({
  selector: 'app-patient-odontogram',
  imports: [OdontogramShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aao-odontogram-shell language="fr" [numberingSystem]="numberingSystem()" [darkMode]="darkMode()" />`,
})
export class PatientOdontogramComponent {
  readonly numberingSystem = input<'FDI' | 'UNIVERSAL' | 'PALMER'>('FDI');
  readonly darkMode = input(false);
}
