import { DatePipe, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { firstValueFrom } from 'rxjs';

type HistoryType='ALLERGY'|'MEDICAL_CONDITION'|'MEDICATION'|'DENTAL_HISTORY'|'PRECAUTION'|'OTHER';
interface HistoryAmendment {id:string;reason:string;correctedContent:string;amendedById:string;amendedByName?:string|null;createdAt:string;}
interface HistoryEntry {id:string;entryType:HistoryType;content:string;recordedById:string;recordedByName?:string|null;createdAt:string;amendments:HistoryAmendment[];}
interface Envelope<T>{data:T;}
const labels:Record<HistoryType,string>={ALLERGY:'Allergie',MEDICAL_CONDITION:'Antécédent médical',MEDICATION:'Médicament',DENTAL_HISTORY:'Antécédent dentaire',PRECAUTION:'Précaution',OTHER:'Autre'};
@Component({selector:'app-patient-clinical-history',imports:[DatePipe,FormsModule],changeDetection:ChangeDetectionStrategy.OnPush,templateUrl:'./patient-clinical-history.component.html',styleUrl:'./patient-clinical-history.component.css'})
export class PatientClinicalHistoryComponent {
 readonly patientId=input.required<string>();readonly tenant=inject(TenantContextService);private readonly http=inject(HttpClient);private readonly platformId=inject(PLATFORM_ID);
 readonly entries=signal<HistoryEntry[]>([]);readonly loading=signal(false);readonly saving=signal(false);readonly error=signal('');readonly success=signal('');readonly showForm=signal(false);
 entryType:HistoryType='ALLERGY';content='';private sequence=0;private context='';
 readonly types:HistoryType[]=['ALLERGY','MEDICAL_CONDITION','MEDICATION','DENTAL_HISTORY','PRECAUTION','OTHER'];
 readonly correctingId=signal<string|null>(null);correctionReason='';correctedContent='';
 constructor(){effect(()=>{const clinic=this.tenant.activeClinic(),patient=this.patientId();if(!isPlatformBrowser(this.platformId))return;if(!clinic||!patient){this.context='';this.entries.set([]);this.error.set('Sélectionnez une clinique autorisée.');return;}const next=`${clinic.organizationId}:${clinic.id}:${patient}`;if(next===this.context)return;this.context=next;void this.load(next,clinic.organizationId,clinic.id,patient);});}
 label(type:HistoryType){return labels[type]??'Autre';}
 beginCorrection(entry:HistoryEntry){this.correctingId.set(entry.id);this.correctionReason='';this.correctedContent=entry.amendments?.length?entry.amendments[entry.amendments.length-1].correctedContent:entry.content;this.error.set('');this.success.set('');}
 cancelCorrection(){this.correctingId.set(null);this.correctionReason='';this.correctedContent='';}
 async amend(entry:HistoryEntry):Promise<void>{const c=this.tenant.activeClinic(),reason=this.correctionReason.trim(),correctedContent=this.correctedContent.trim();if(!c||!reason||!correctedContent||this.saving())return;this.saving.set(true);this.error.set('');this.success.set('');try{await firstValueFrom(this.http.post(this.url(c.organizationId,c.id,this.patientId())+'/'+encodeURIComponent(entry.id)+'/amendments',{reason,correctedContent},{withCredentials:true}));this.cancelCorrection();await this.load(this.context,c.organizationId,c.id,this.patientId());this.success.set('Correction ajoutée à l’historique. La version précédente est conservée.');}catch(e){this.error.set(e instanceof HttpErrorResponse&&e.status===403?'Votre rôle ne permet pas de corriger cet antécédent.':'La correction n’a pas été enregistrée.');}finally{this.saving.set(false);}}
 private url(org:string,clinic:string,patient:string){return `/api/v1/organizations/${encodeURIComponent(org)}/clinics/${encodeURIComponent(clinic)}/patients/${encodeURIComponent(patient)}/clinical-history`;}
 async load(context=this.context,org=this.tenant.activeClinic()?.organizationId??'',clinic=this.tenant.activeClinic()?.id??'',patient=this.patientId()):Promise<void>{if(!org||!clinic||!patient)return;const seq=++this.sequence;this.loading.set(true);this.error.set('');try{const result=await firstValueFrom(this.http.get<Envelope<HistoryEntry[]>>(this.url(org,clinic,patient),{withCredentials:true}));if(seq===this.sequence&&context===this.context)this.entries.set(result.data);}catch(e){if(seq===this.sequence)this.error.set(e instanceof HttpErrorResponse&&e.status===403?'Votre rôle ne permet pas de consulter les antécédents cliniques.':'Les antécédents cliniques ne peuvent pas être chargés.');}finally{if(seq===this.sequence)this.loading.set(false);}}
 async save():Promise<void>{const c=this.tenant.activeClinic(),content=this.content.trim();if(!c||!content||this.saving())return;const patient=this.patientId(),context=this.context;this.saving.set(true);this.error.set('');this.success.set('');try{await firstValueFrom(this.http.post(this.url(c.organizationId,c.id,patient),{entryType:this.entryType,content},{withCredentials:true}));this.content='';this.showForm.set(false);await this.load(context,c.organizationId,c.id,patient);this.success.set('Antécédent ajouté au dossier.');}catch(e){this.error.set(e instanceof HttpErrorResponse&&e.status===403?'Votre rôle ne permet pas d’ajouter un antécédent.':'L’antécédent n’a pas été enregistré.');}finally{this.saving.set(false);}}
}
