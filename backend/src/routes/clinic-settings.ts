import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { requireClinicAccess } from '../auth/authorization.js';
import { pool } from '../db/pool.js';
import { normalizeIanaTimeZone } from '../domain/timezone-policy.js';

interface Params { organizationId:string; clinicId:string; }
interface ClinicProfileBody { name:string; city:string|null; address:string|null; phone:string|null; email:string|null; timezone:string; }
const profileSchema={
  type:'object',additionalProperties:false,required:['name','city','address','phone','email','timezone'],
  properties:{
    name:{type:'string',minLength:1,maxLength:160},
    city:{anyOf:[{type:'string',maxLength:120},{type:'null'}]},
    address:{anyOf:[{type:'string',maxLength:500},{type:'null'}]},
    phone:{anyOf:[{type:'string',maxLength:40},{type:'null'}]},
    email:{anyOf:[{type:'string',format:'email',maxLength:254},{type:'null'}]},
    timezone:{type:'string',minLength:1,maxLength:100},
  },
} as const;
const settingsRoles=new Set(['ORGANIZATION_OWNER','ORGANIZATION_ADMIN','CLINIC_ADMIN']);

export const clinicSettingsRoutes:FastifyPluginAsync=async(app)=>{
  app.get<{Params:Params}>('/organizations/:organizationId/clinics/:clinicId/settings/profile',async(request,reply)=>{
    const {organizationId,clinicId}=request.params;
    const access=await requireClinicAccess(request,reply,organizationId,clinicId);
    if(!access)return;
    const result=await pool.query(
      `SELECT id,name,city,address,phone,email,timezone,updated_at AS "updatedAt"
       FROM clinics WHERE organization_id=$1 AND id=$2 AND status='ACTIVE'`,
      [organizationId,clinicId],
    );
    if(!result.rowCount)return reply.code(404).send({error:{code:'CLINIC_NOT_FOUND',message:'Clinic not found.'}});
    return {data:result.rows[0],canEdit:settingsRoles.has(access.effectiveRole)};
  });

  app.put<{Params:Params;Body:ClinicProfileBody}>(
    '/organizations/:organizationId/clinics/:clinicId/settings/profile',
    {schema:{body:profileSchema}},
    async(request,reply)=>{
      const {organizationId,clinicId}=request.params;
      const access=await requireClinicAccess(request,reply,organizationId,clinicId);
      if(!access)return;
      if(!settingsRoles.has(access.effectiveRole))return reply.code(403).send({error:{code:'FORBIDDEN',message:'Only clinic administrators can change clinic profile settings.'}});
      const body=request.body;
      const name=body.name.trim();
      if(!name)return reply.code(400).send({error:{code:'INVALID_CLINIC_NAME',message:'A clinic name is required.'}});
      const clean=(value:string|null)=>value?.trim()||null;
      const timezone=normalizeIanaTimeZone(body.timezone);
      if(!timezone)return reply.code(400).send({error:{code:'INVALID_TIMEZONE',message:'Choose a valid IANA time zone, such as Africa/Casablanca.'}});
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const result=await client.query(
          `UPDATE clinics SET name=$3,city=$4,address=$5,phone=$6,email=$7,timezone=$8,updated_at=now()
           WHERE organization_id=$1 AND id=$2 AND status='ACTIVE'
           RETURNING id,name,city,address,phone,email,timezone,updated_at AS "updatedAt"`,
          [organizationId,clinicId,name,clean(body.city),clean(body.address),clean(body.phone),clean(body.email)?.toLowerCase()??null,timezone],
        );
        if(!result.rowCount){await client.query('ROLLBACK');return reply.code(404).send({error:{code:'CLINIC_NOT_FOUND',message:'Clinic not found.'}});}
        await client.query(
          `INSERT INTO audit_events(id,organization_id,user_id,action,resource_type,resource_id,metadata)
           VALUES($1,$2,$3,'CLINIC_PROFILE_UPDATED','CLINIC',$4,$5::jsonb)`,
          [randomUUID(),organizationId,access.userId,clinicId,JSON.stringify({changedFields:['name','city','address','phone','email','timezone']})],
        );
        await client.query('COMMIT');
        return {data:result.rows[0]};
      }catch(error){await client.query('ROLLBACK');throw error;}
      finally{client.release();}
    },
  );
};
