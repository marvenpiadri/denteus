import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { DentalDataService } from '../../core/services/dental-data.service';
import { TenantService } from '../../core/services/tenant.service';
import { OdontogramTreatmentPlanService } from '../../core/services/odontogram-treatment-plan.service';
import { OdontogramPersistenceService } from '../../core/services/odontogram-persistence.service';

@Component({
  selector: 'app-patient-treatment-plans',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    ${treatmentBlock.replaceAll('      ','    ')}
  `,
})
export class PatientTreatmentPlansComponent {
  readonly patientId = input.required<string>();
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);
  readonly tenantService = inject(TenantService);
  readonly odontogramTreatmentPlan = inject(OdontogramTreatmentPlanService);
  readonly odontogramPersistence = inject(OdontogramPersistenceService);

  readonly odontogramPlanCandidates = computed(() => {
    if (this.odontogramPersistence.attachedPatientId() !== this.patientId()) return [];
    return this.odontogramTreatmentPlan.getCandidates(
      this.odontogramPersistence.planChanges(),
      this.dataService.procedures(),
    );
  });

  createTreatmentPlanFromOdontogram(): void {
    const candidates = this.odontogramPlanCandidates();
    if (!candidates.length) return;

    const planId = `pending-${Date.now()}`;
    const items = this.odontogramTreatmentPlan.buildItems(planId, candidates);
    const subtotal = items.reduce((sum, item) => sum + item.fee, 0);

    this.dataService.addTreatmentPlan({
      patientId: this.patientId(),
      clinicId: this.tenantService.currentClinicId(),
      doctorId: this.tenantService.currentUserId(),
      doctorName: this.tenantService.currentUser().name,
      title: 'Plan issu de l’odontogramme',
      status: 'planned',
      items,
      subtotal,
      discountPercent: 0,
      total: subtotal,
      notes: 'Généré à partir des différences entre le statut clinique et le plan odontogramme.',
    });
  }
}
