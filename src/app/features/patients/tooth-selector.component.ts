import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-tooth-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tooth-selector.component.html',
  styleUrl: './tooth-selector.component.css',
})
export class ToothSelectorComponent {
  @Input() selectedTeeth: number[] = [];
  @Input() treatedTeeth: number[] = [];
  @Input() showPrimary = false;
  @Output() selectedTeethChange = new EventEmitter<number[]>();
  @Output() showPrimaryChange = new EventEmitter<boolean>();

  readonly permanentUpperRight = [18, 17, 16, 15, 14, 13, 12, 11];
  readonly permanentUpperLeft = [21, 22, 23, 24, 25, 26, 27, 28];
  readonly permanentLowerRight = [48, 47, 46, 45, 44, 43, 42, 41];
  readonly permanentLowerLeft = [31, 32, 33, 34, 35, 36, 37, 38];
  readonly primaryUpperRight = [55, 54, 53, 52, 51];
  readonly primaryUpperLeft = [61, 62, 63, 64, 65];
  readonly primaryLowerRight = [85, 84, 83, 82, 81];
  readonly primaryLowerLeft = [71, 72, 73, 74, 75];

  isSelected(tooth: number): boolean { return this.selectedTeeth.includes(tooth); }
  hasHistory(tooth: number): boolean { return this.treatedTeeth.includes(tooth); }

  toggle(tooth: number): void {
    this.selectedTeethChange.emit(this.isSelected(tooth)
      ? this.selectedTeeth.filter((item) => item !== tooth)
      : [...this.selectedTeeth, tooth].sort((a, b) => a - b));
  }

  togglePrimary(): void { this.showPrimaryChange.emit(!this.showPrimary); }
}
