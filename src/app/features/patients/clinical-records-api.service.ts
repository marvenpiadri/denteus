import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type EncounterType='CONSULTATION'|'EMERGENCY'|'FOLLOW_UP'|'PROCEDURE'|'OTHER';
export type NoteType='CHIEF_COMPLAINT'|'EXAMINATION'|'ASSESSMENT'|'PROGRESS'|'DISCHARGE'|'OTHER';
export interface ClinicalNote { id:string; noteType:NoteType; content:string; createdByName?:string|null; signedById:string|null; signedByName?:string|null; signedAt:string|null; createdAt:string; amendments:Array<{id:string;reason:string;amendedContent:string;amendedById:string|null;createdAt:string}>; }
export interface Encounter { id:string; appointmentId:string|null; status:string; encounterType:EncounterType; responsibleDentistId:string|null; responsibleDentistName?:string|null; startedAt:string; chiefComplaint:string|null; createdByName?:string|null; signedById:string|null; signedByName:string|null; signedAt:string|null; noteCount:number; procedureCount:number; mediaCount:number; notes:ClinicalNote[]; findings:Array<{id:string;findingType:string;description:string;severity:string|null;toothNo:number|null;surface:string|null;createdAt:string}>; procedures:Array<{id:string;title:string;category:string;status:string;notes:string|null;performedAt:string|null;toothSites:Array<{toothNo:number;surface:string}>}>; media:Array<{id:string;mediaType:string;storageKey:string;originalFilename:string|null;mimeType:string;sizeBytes:number;capturedAt:string|null;description:string|null;createdAt:string}>; followUps:Array<{id:string;dueAt:string|null;instruction:string;status:string;createdAt:string}>; participants:Array<{userId:string;name:string;role:string;createdAt:string}>; }
interface Envelope<T>{data:T;count?:number}
@Injectable({providedIn:'root'})
export class ClinicalRecordsApiService {
 private readonly http=inject(HttpClient);
 private url(org:string,clinic:string,patient:string){return `/api/v1/organizations/${encodeURIComponent(org)}/clinics/${encodeURIComponent(clinic)}/patients/${encodeURIComponent(patient)}/encounters`;}
 async list(org:string,clinic:string,patient:string){return (await firstValueFrom(this.http.get<Envelope<Encounter[]>>(this.url(org,clinic,patient),{withCredentials:true}))).data;}
 async get(org:string,clinic:string,patient:string,id:string){return (await firstValueFrom(this.http.get<Envelope<Encounter>>(`${this.url(org,clinic,patient)}/${encodeURIComponent(id)}`,{withCredentials:true}))).data;}
 async create(org:string,clinic:string,patient:string,input:{encounterType:EncounterType;chiefComplaint:string|null}){return (await firstValueFrom(this.http.post<Envelope<Encounter>>(this.url(org,clinic,patient),input,{withCredentials:true}))).data;}
 async createNote(org:string,clinic:string,patient:string,encounter:string,input:{noteType:NoteType;content:string}){return (await firstValueFrom(this.http.post<Envelope<ClinicalNote>>(`${this.url(org,clinic,patient)}/${encodeURIComponent(encounter)}/notes`,input,{withCredentials:true}))).data;}
 async signNote(org:string,clinic:string,patient:string,encounter:string,note:string){await firstValueFrom(this.http.post(`${this.url(org,clinic,patient)}/${encodeURIComponent(encounter)}/notes/${encodeURIComponent(note)}/sign`,{},{withCredentials:true}));}
 async amend(org:string,clinic:string,patient:string,encounter:string,note:string,input:{reason:string;amendedContent:string}){return (await firstValueFrom(this.http.post<Envelope<ClinicalNote['amendments'][number]>>(`${this.url(org,clinic,patient)}/${encodeURIComponent(encounter)}/notes/${encodeURIComponent(note)}/amendments`,input,{withCredentials:true}))).data;}
}