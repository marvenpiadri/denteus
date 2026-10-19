import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { canReadOdontogram, canWriteOdontogram, denyInsufficientRole, hasActiveClinicalProvider, requireClinicAccess } from '../auth/authorization.js';
import { pool } from '../db/pool.js';

interface PatientHistoryParams { organizationId:string; clinicId:string; patientId:string; }
interface CreateHistoryBody { entryType:'ALLERGY'|'MEDICAL_CONDITION'|'MEDICATION'|'DENTAL_HISTORY'|'PRECAUTION'|'OTHER'; content:string; }
const createSchema = {
  type:'object', additionalProperties:false, required:['entryType','content'],
  properties:{
    entryType:{type:'string',enum:['ALLERGY','MEDICAL_CONDITION','MEDICATION','DENTAL_HISTORY','PRECAUTION','OTHER']},
    content:{type:'string',minLength:1,maxLength:8000},
  },
} as const;

export const patientHistoryRoutes:FastifyPluginAsync=async(app)=>{
  app.get<{Params:PatientHistoryParams}>('/organizations/:organizationId/clinics/:clinicId/patients/:patientId/clinical-history',async(request,reply)=>{
    const {organizationId,clinicId,patientId}=request.params;
    const access=await requireClinicAccess(request,reply,organizationId,clinicId);
    if(!access)return;
    if(!canReadOdontogram(access))return denyInsufficientRole(reply);
    const patient=await pool.query(
      'SELECT 1 FROM patient_clinics WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3',
      [organizationId,clinicId,patientId],
    );
    if(!patient.rowCount)return reply.code(404).send({error:{code:'PATIENT_NOT_FOUND',message:'Patient not found.'}});
    const result=await pool.query(
      `SELECT h.id,h.entry_type AS "entryType",h.content,h.recorded_by_id AS "recordedById",
              u.name AS "recordedByName",h.created_at AS "createdAt",
              COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'reason',a.reason,'correctedContent',a.corrected_content,'amendedById',a.amended_by_id,'amendedByName',au.name,'createdAt',a.created_at) ORDER BY a.created_at,a.id)
                FROM patient_clinical_history_amendments a LEFT JOIN app_users au ON au.id=a.amended_by_id
                WHERE a.organization_id=h.organization_id AND a.clinic_id=h.clinic_id AND a.patient_id=h.patient_id AND a.history_entry_id=h.id),'[]'::jsonb) AS amendments
       FROM patient_clinical_history_entries h
       JOIN app_users u ON u.id=h.recorded_by_id
       WHERE h.organization_id=$1 AND h.clinic_id=$2 AND h.patient_id=$3
       ORDER BY h.created_at DESC,h.id DESC LIMIT 500`,
      [organizationId,clinicId,patientId],
    );
    return {data:result.rows};
  });
  app.post<{Params:PatientHistoryParams;Body:CreateHistoryBody}>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/clinical-history',
    {schema:{body:createSchema}},
    async(request,reply)=>{
      const {organizationId,clinicId,patientId}=request.params;
      const access=await requireClinicAccess(request,reply,organizationId,clinicId);
      if(!access)return;
      if(!canWriteOdontogram(access))return denyInsufficientRole(reply);
      const content=request.body.content.trim();
      if(!content)return reply.code(400).send({error:{code:'EMPTY_HISTORY_ENTRY',message:'Clinical history content is required.'}});
      const patient=await pool.query(
        'SELECT 1 FROM patient_clinics WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3',
        [organizationId,clinicId,patientId],
      );
      if(!patient.rowCount)return reply.code(404).send({error:{code:'PATIENT_NOT_FOUND',message:'Patient not found.'}});
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const result=await client.query(
          `INSERT INTO patient_clinical_history_entries(id,organization_id,clinic_id,patient_id,entry_type,content,recorded_by_id)
           VALUES($1,$2,$3,$4,$5,$6,$7)
           RETURNING id,entry_type AS "entryType",content,recorded_by_id AS "recordedById",created_at AS "createdAt"`,
          [randomUUID(),organizationId,clinicId,patientId,request.body.entryType,content,access.userId],
        );
        await client.query(
          `INSERT INTO audit_events(id,organization_id,user_id,action,resource_type,resource_id,metadata)
           VALUES($1,$2,$3,'PATIENT_CLINICAL_HISTORY_RECORDED','PATIENT_CLINICAL_HISTORY',$4,$5::jsonb)`,
          [randomUUID(),organizationId,access.userId,result.rows[0].id,JSON.stringify({clinicId,patientId,entryType:request.body.entryType})],
        );
        await client.query('COMMIT');
        return reply.code(201).send({data:result.rows[0]});
      }catch(error){await client.query('ROLLBACK');throw error;}
      finally{client.release();}
    },
  );

  app.post<{Params:PatientHistoryParams & {historyEntryId:string};Body:{reason:string;correctedContent:string}}>(
    '/organizations/:organizationId/clinics/:clinicId/patients/:patientId/clinical-history/:historyEntryId/amendments',
    {schema:{body:{type:'object',additionalProperties:false,required:['reason','correctedContent'],properties:{reason:{type:'string',minLength:1,maxLength:1000},correctedContent:{type:'string',minLength:1,maxLength:8000}}}}},
    async(request,reply)=>{
      const {organizationId,clinicId,patientId,historyEntryId}=request.params;
      const access=await requireClinicAccess(request,reply,organizationId,clinicId);
      if(!access)return;
      if(!canWriteOdontogram(access))return denyInsufficientRole(reply);
      if(!await hasActiveClinicalProvider(organizationId,clinicId,access.userId,['DENTIST','ORTHODONTIST','HYGIENIST']))return reply.code(403).send({error:{code:'CLINICIAN_REQUIRED',message:'An active clinical provider account is required to amend patient history.'}});
      const reason=request.body.reason.trim(),correctedContent=request.body.correctedContent.trim();
      if(!reason||!correctedContent)return reply.code(400).send({error:{code:'INVALID_AMENDMENT',message:'A reason and corrected content are required.'}});
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const entry=await client.query(
          'SELECT id FROM patient_clinical_history_entries WHERE organization_id=$1 AND clinic_id=$2 AND patient_id=$3 AND id=$4 FOR UPDATE',
          [organizationId,clinicId,patientId,historyEntryId],
        );
        if(!entry.rowCount){await client.query('ROLLBACK');return reply.code(404).send({error:{code:'HISTORY_ENTRY_NOT_FOUND',message:'Clinical history entry not found.'}});}
        const result=await client.query(
          `INSERT INTO patient_clinical_history_amendments(id,organization_id,clinic_id,patient_id,history_entry_id,reason,corrected_content,amended_by_id)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id,reason,corrected_content AS "correctedContent",amended_by_id AS "amendedById",created_at AS "createdAt"`,
          [randomUUID(),organizationId,clinicId,patientId,historyEntryId,reason,correctedContent,access.userId],
        );
        await client.query(
          `INSERT INTO audit_events(id,organization_id,user_id,action,resource_type,resource_id,metadata)
           VALUES($1,$2,$3,'PATIENT_CLINICAL_HISTORY_AMENDED','PATIENT_CLINICAL_HISTORY',$4,$5::jsonb)`,
          [randomUUID(),organizationId,access.userId,historyEntryId,JSON.stringify({clinicId,patientId,amendmentId:result.rows[0].id,reason})],
        );
        await client.query('COMMIT');
        return reply.code(201).send({data:result.rows[0]});
      }catch(error){await client.query('ROLLBACK');throw error;}
      finally{client.release();}
    },
  );
};
