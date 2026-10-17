import { DatePipe, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { PatientApiService } from './patient-api.service';
import type { PatientRecord, UpdatePatientInput } from './patient-api.service';
import { PatientTreatmentApiService } from './patient-treatment-api.service';
import type { CreatePatientTreatmentInput, PatientTreatment, ToothSurface, TreatmentCategory, TreatmentStatus } from './patient-treatment-api.service';
import { ToothSelectorComponent } from './tooth-selector.component';

@Component({
  selector: 'app-patient-detail-page',
  imports: [FormsModule, DatePipe, RouterLink, ToothSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './patient-detail-page.component.html',
  styleUrl: './patient-detail-page.component.css',
})
export class PatientDetailPageComponent {
  readonly tenant = inject(TenantContextService);
  private readonly api = inject(PatientApiService);
  private readonly treatmentApi = inject(PatientTreatmentApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  readonly patientId = toSignal(this.route.paramMap.pipe(map((params) => params.get('patientId'))), { initialValue: null });

  readonly patient = signal<PatientRecord | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly editing = signal(false);
  readonly conflict = signal(false);
  readonly treatments = signal<PatientTreatment[]>([]);
  readonly treatmentsLoading = signal(false);
  readonly treatmentsSaving = signal(false);
  readonly treatmentsError = signal('');
  readonly treatmentsSuccess = signal('');
  readonly showTreatmentForm = signal(false);
  readonly selectedTeeth = signal<number[]>([]);
  readonly treatedTeeth = computed(() => [...new Set(this.treatments().flatMap((item) => item.toothSites.map((site) => site.toothNo)))]);
  readonly treatmentCategories: { value: TreatmentCategory; label: string }[] = [
    { value: 'EXAM', label: 'Examen / diagnostic' }, { value: 'HYGIENE', label: 'Détartrage / hygiène' },
    { value: 'RESTORATIVE', label: 'Soin restaurateur / obturation' }, { value: 'ENDODONTICS', label: 'Endodontie' },
    { value: 'EXTRACTION', label: 'Extraction' }, { value: 'PROSTHODONTICS', label: 'Prothèse / couronne' },
    { value: 'ORTHODONTICS', label: 'Orthodontie' }, { value: 'PERIODONTICS', label: 'Parodontologie' },
    { value: 'IMPLANT', label: 'Implantologie' }, { value: 'OTHER', label: 'Autre soin' },
  ];
  readonly toothSurfaces: { value: ToothSurface; label: string }[] = [
    { value: 'WHOLE', label: 'Dent entière' }, { value: 'OCCLUSAL', label: 'Occlusale' },
    { value: 'MESIAL', label: 'Mésiale' }, { value: 'DISTAL', label: 'Distale' },
    { value: 'BUCCAL', label: 'Vestibulaire' }, { value: 'LINGUAL', label: 'Linguale' },
    { value: 'PALATAL', label: 'Palatine' }, { value: 'CERVICAL', label: 'Cervicale' },
  ];

  firstName = '';
  lastName = '';
  birthDate = '';
  gender: '' | 'M' | 'F' | 'OTHER' = '';
  phone = '';
  email = '';
  address = '';
  city = '';
  notes = '';
  treatmentTitle = '';
  treatmentCategory: TreatmentCategory = 'RESTORATIVE';
  treatmentStatus: TreatmentStatus = 'PLANNED';
  treatmentSurface: ToothSurface = 'WHOLE';
  treatmentNotes = '';
  private requestSequence = 0;

  constructor() {
    effect(() => {
      const clinic = this.tenant.activeClinic();
      const patientId = this.patientId();
      if (isPlatformBrowser(this.platformId) && clinic && patientId) {
        void this.loadPatient(clinic.organizationId, clinic.id, patientId);
      }
    });
  }

  async loadPatient(organizationId?: string, clinicId?: string, patientId = this.patientId() ?? ''): Promise<void> {
    const clinic = this.tenant.activeClinic();
    const organization = organizationId ?? clinic?.organizationId;
    const activeClinicId = clinicId ?? clinic?.id;
    if (!organization || !activeClinicId || !patientId) return;
    const requestSequence = ++this.requestSequence;
    this.patient.set(null);
    this.loading.set(true);
    this.error.set('');
    this.conflict.set(false);
    try {
      const patient = await this.api.get(organization, activeClinicId, patientId);
      if (requestSequence !== this.requestSequence) return;
      this.patient.set(patient);
      this.treatments.set([]);
      void this.loadTreatments(organization, activeClinicId, patientId, requestSequence);
      this.firstName = patient.firstName;
      this.lastName = patient.lastName;
      this.birthDate = patient.birthDate ? patient.birthDate.slice(0, 10) : '';
      this.gender = patient.gender ?? '';
      this.phone = patient.phone ?? '';
      this.email = patient.email ?? '';
      this.address = patient.address ?? '';
      this.city = patient.city ?? '';
      this.notes = patient.notes ?? '';
    } catch (error) {
      if (requestSequence !== this.requestSequence) return;
      this.patient.set(null);
      this.error.set(error instanceof HttpErrorResponse && error.status === 404
        ? 'Ce dossier n’existe pas dans la clinique active ou vous n’y avez pas accès.'
        : error instanceof HttpErrorResponse && error.status === 401
          ? 'Votre session a expiré. Reconnectez-vous.'
          : 'Le dossier ne peut pas être chargé. Vérifiez votre connexion puis réessayez.');
    } finally {
      if (requestSequence === this.requestSequence) this.loading.set(false);
    }
  }

  private async loadTreatments(organizationId: string, clinicId: string, patientId: string, requestSequence: number): Promise<void> {
    this.treatmentsLoading.set(true);
    this.treatmentsError.set('');
    try {
      const records = await this.treatmentApi.list(organizationId, clinicId, patientId);
      if (requestSequence !== this.requestSequence || this.patientId() !== patientId || this.tenant.activeClinic()?.id !== clinicId) return;
      this.treatments.set(records);
    } catch (error) {
      if (requestSequence !== this.requestSequence) return;
      this.treatments.set([]);
      this.treatmentsError.set(error instanceof HttpErrorResponse && error.status === 403
        ? 'Votre rôle ne permet pas de consulter les informations cliniques de ce patient.'
        : 'L’historique des soins ne peut pas être chargé. Réessayez.');
    } finally {
      if (requestSequence === this.requestSequence) this.treatmentsLoading.set(false);
    }
  }

  async saveTreatment(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    const patient = this.patient();
    if (!clinic || !patient || this.treatmentsSaving() || !this.treatmentTitle.trim()) return;
    this.treatmentsSaving.set(true);
    this.treatmentsError.set('');
    this.treatmentsSuccess.set('');
    const input: CreatePatientTreatmentInput = {
      title: this.treatmentTitle.trim(),
      category: this.treatmentCategory,
      status: this.treatmentStatus,
      notes: this.treatmentNotes.trim() || null,
      toothSites: this.selectedTeeth().map((toothNo) => ({ toothNo, surface: this.treatmentSurface })),
    };
    try {
      const created = await this.treatmentApi.create(clinic.organizationId, clinic.id, patient.id, input);
      if (this.tenant.activeClinic()?.id !== clinic.id || this.patientId() !== patient.id) return;
      this.treatments.set([created, ...this.treatments()]);
      this.treatmentTitle = '';
      this.treatmentCategory = 'RESTORATIVE';
      this.treatmentStatus = 'PLANNED';
      this.treatmentSurface = 'WHOLE';
      this.treatmentNotes = '';
      this.selectedTeeth.set([]);
      this.showTreatmentForm.set(false);
      this.treatmentsSuccess.set('Le soin et les dents concernées ont été enregistrés dans l’historique du patient.');
    } catch (error) {
      this.treatmentsError.set(error instanceof HttpErrorResponse && error.status === 403
        ? 'Votre rôle ne permet pas d’ajouter un soin clinique.'
        : error instanceof HttpErrorResponse && error.status === 400
          ? 'Vérifiez les dents, les surfaces et les informations du soin.'
          : 'Le soin n’a pas été enregistré. Réessayez.');
    } finally {
      this.treatmentsSaving.set(false);
    }
  }

  formatTreatmentDate(value: string | null): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: this.tenant.activeClinic()?.timezone || 'Africa/Casablanca',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  surfaceLabel(surface: ToothSurface): string {
    return this.toothSurfaces.find((item) => item.value === surface)?.label ?? surface;
  }

  treatmentStatusLabel(status: TreatmentStatus): string {
    return ({ PLANNED: 'Prévu', ACCEPTED: 'Accepté', COMPLETED: 'Réalisé', DECLINED: 'Refusé' })[status];
  }

  treatmentCategoryLabel(category: TreatmentCategory): string {
    return this.treatmentCategories.find((item) => item.value === category)?.label ?? 'Autre soin';
  }

  availableTreatmentTransitions(status: TreatmentStatus): TreatmentStatus[] {
    return status === 'PLANNED' ? ['ACCEPTED', 'COMPLETED', 'DECLINED']
      : status === 'ACCEPTED' ? ['COMPLETED', 'DECLINED'] : [];
  }

  async changeTreatmentStatus(treatment: PatientTreatment, status: TreatmentStatus): Promise<void> {
    const clinic = this.tenant.activeClinic();
    const patient = this.patient();
    if (!clinic || !patient || this.treatmentsSaving()) return;
    this.treatmentsSaving.set(true);
    this.treatmentsError.set('');
    this.treatmentsSuccess.set('');
    try {
      await this.treatmentApi.changeStatus(clinic.organizationId, clinic.id, patient.id, treatment.id, status);
      const records = await this.treatmentApi.list(clinic.organizationId, clinic.id, patient.id);
      if (this.tenant.activeClinic()?.id !== clinic.id || this.patientId() !== patient.id) return;
      this.treatments.set(records);
      this.treatmentsSuccess.set('Le statut du soin a été enregistré dans son historique.');
    } catch (error) {
      this.treatmentsError.set(error instanceof HttpErrorResponse && error.status === 409
        ? 'Cette transition n’est plus autorisée. Actualisez l’historique.'
        : 'Le statut du soin n’a pas été modifié.');
    } finally {
      this.treatmentsSaving.set(false);
    }
  }

  formatBirthDate(value: string | null): string {
    if (!value) return 'Non renseignée';
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
  }

  async save(): Promise<void> {
    const clinic = this.tenant.activeClinic();
    const patient = this.patient();
    if (!clinic || !patient || this.saving()) return;
    this.error.set('');
    this.success.set('');
    this.saving.set(true);
    const input: UpdatePatientInput = {
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      birthDate: this.birthDate || null,
      gender: this.gender || null,
      phone: this.phone.trim() || null,
      email: this.email.trim().toLowerCase() || null,
      address: this.address.trim() || null,
      city: this.city.trim() || null,
      notes: this.notes.trim() || null,
      expectedUpdatedAt: patient.updatedAt,
    };
    try {
      const saved = await this.api.update(clinic.organizationId, clinic.id, patient.id, input);
      if (this.tenant.activeClinic()?.id !== clinic.id || this.patientId() !== patient.id) return;
      this.patient.set(saved);
      this.editing.set(false);
      this.success.set('Les modifications ont été enregistrées.');
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.conflict.set(true);
        this.error.set('Ce dossier a été modifié dans une autre session. Rechargez la dernière version avant de réessayer.');
      } else if (error instanceof HttpErrorResponse && error.status === 403) {
        this.error.set('Votre rôle ne permet pas de modifier ce dossier patient.');
      } else {
        this.error.set('Les modifications n’ont pas été enregistrées. Le dossier affiché reste inchangé.');
      }
    } finally {
      this.saving.set(false);
    }
  }

  cancelEdit(): void {
    this.editing.set(false);
    const patient = this.patient();
    if (!patient) return;
    this.firstName = patient.firstName;
    this.lastName = patient.lastName;
    this.birthDate = patient.birthDate ? patient.birthDate.slice(0, 10) : '';
    this.gender = patient.gender ?? '';
    this.phone = patient.phone ?? '';
    this.email = patient.email ?? '';
    this.address = patient.address ?? '';
    this.city = patient.city ?? '';
    this.notes = patient.notes ?? '';
  }
}
