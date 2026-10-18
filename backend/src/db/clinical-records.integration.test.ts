import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL integration tests.');
const pool = new Pool({ connectionString, max: 2 });

test('clinical records enforce clinic scope and preserve signed notes through amendments', async () => {
 const suffix = randomUUID(), userId = `clinical-user-${suffix}`, orgId = `clinical-org-${suffix}`;
 const clinicId = `clinical-clinic-${suffix}`, otherClinicId = `clinical-other-clinic-${suffix}`, providerId = `clinical-provider-${suffix}`;
 const patientId = `clinical-patient-${suffix}`, encounterId = `encounter-${suffix}`, noteId = `note-${suffix}`, amendmentId = `amendment-${suffix}`;
 const client = await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query('INSERT INTO app_users (id, name, email) VALUES ($1, $2, $3)', [userId, 'Clinical Test', `${suffix}@example.invalid`]);
  await client.query('INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)', [orgId, 'Clinical Test', `clinical-${suffix}`]);
  await client.query('INSERT INTO organization_memberships (id, organization_id, user_id, role) VALUES ($1, $2, $3, $4)', [`om-${suffix}`, orgId, userId, 'ORGANIZATION_OWNER']);
  await client.query('INSERT INTO clinics (id, organization_id, name) VALUES ($1, $2, $3), ($4, $2, $5)', [clinicId, orgId, 'Clinic A', otherClinicId, 'Clinic B']);
  await client.query('INSERT INTO clinic_memberships (id, organization_id, clinic_id, user_id, role) VALUES ($1, $2, $3, $4, $5)', [`cm-${suffix}`, orgId, clinicId, userId, 'ORGANIZATION_OWNER']);
  await client.query('INSERT INTO patients (id, organization_id, patient_number, first_name, last_name) VALUES ($1, $2, $3, $4, $5)', [patientId, orgId, `CLIN-${suffix}`, 'Test', 'Patient']);
  await client.query('INSERT INTO patient_clinics (organization_id, patient_id, clinic_id) VALUES ($1, $2, $3)', [orgId, patientId, clinicId]);
  await client.query(`INSERT INTO clinic_providers (id, organization_id, clinic_id, user_id, display_name, role) VALUES ($1, $2, $3, $4, 'Clinical Dentist', 'DENTIST')`, [providerId, orgId, clinicId, userId]);
  await client.query('INSERT INTO clinical_encounters (id, organization_id, clinic_id, patient_id, responsible_provider_id, created_by_id) VALUES ($1, $2, $3, $4, $5, $6)', [encounterId, orgId, clinicId, patientId, providerId, userId]);
  await client.query("INSERT INTO clinical_notes (id, organization_id, clinic_id, patient_id, encounter_id, content, created_by_id) VALUES ($1, $2, $3, $4, $5, 'Signed source note', $6)", [noteId, orgId, clinicId, patientId, encounterId, userId]);
  await client.query('UPDATE clinical_notes SET signed_at = now(), signed_by_id = $2, updated_by_id = $2, version = version + 1 WHERE id = $1', [noteId, userId]);
  await client.query("INSERT INTO clinical_note_amendments (id, organization_id, clinic_id, patient_id, encounter_id, note_id, reason, amended_content, amended_by_id) VALUES ($1, $2, $3, $4, $5, $6, 'Typographic correction', 'Corrected text', $7)", [amendmentId, orgId, clinicId, patientId, encounterId, noteId, userId]);
  await client.query('SAVEPOINT signed_note_immutable');
  await assert.rejects(client.query("UPDATE clinical_notes SET content = 'Overwritten' WHERE id = $1", [noteId]), (error) => error.code === '55000');
  await client.query('ROLLBACK TO SAVEPOINT signed_note_immutable'); await client.query('RELEASE SAVEPOINT signed_note_immutable');
  await client.query('SAVEPOINT amendment_immutable');
  await assert.rejects(client.query("UPDATE clinical_note_amendments SET amended_content = 'Overwritten' WHERE id = $1", [amendmentId]), (error) => error.code === '55000');
  await client.query('ROLLBACK TO SAVEPOINT amendment_immutable'); await client.query('RELEASE SAVEPOINT amendment_immutable');
  await client.query('SAVEPOINT cross_clinic_scope');
  await assert.rejects(client.query('INSERT INTO clinical_encounters (id, organization_id, clinic_id, patient_id, responsible_provider_id, created_by_id) VALUES ($1, $2, $3, $4, $5, $6)', [`bad-${suffix}`, orgId, otherClinicId, patientId, providerId, userId]), (error) => error.code === '23503');
  await client.query('ROLLBACK TO SAVEPOINT cross_clinic_scope'); await client.query('RELEASE SAVEPOINT cross_clinic_scope');
  const saved = await client.query('SELECT content, signed_at, signed_by_id FROM clinical_notes WHERE id = $1', [noteId]);
  assert.equal(saved.rows[0]?.content, 'Signed source note'); assert.ok(saved.rows[0]?.signed_at); assert.equal(saved.rows[0]?.signed_by_id, userId);
  assert.equal((await client.query('SELECT count(*)::int AS count FROM clinical_note_amendments WHERE note_id = $1', [noteId])).rows[0]?.count, 1);
  await client.query('ROLLBACK');
 } finally { client.release(); }
});
test.after(async () => { await pool.end(); });
