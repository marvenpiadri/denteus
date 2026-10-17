import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL is required for PostgreSQL integration tests.');
}
const pool = new Pool({ connectionString, max: 2 });

test('tenant constraints isolate clinics, patients, and odontograms', async () => {
  const suffix = randomUUID();
  const userId = `user-${suffix}`;
  const orgA = `org-a-${suffix}`;
  const orgB = `org-b-${suffix}`;
  const clinicA = `clinic-a-${suffix}`;
  const clinicB = `clinic-b-${suffix}`;
  const patientId = `patient-${suffix}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO app_users (id, name, email) VALUES ($1, $2, $3)',
      [userId, 'Integration Test', `${suffix}@example.invalid`],
    );
    await client.query(
      'INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3), ($4, $5, $6)',
      [orgA, 'Test Organization A', `test-a-${suffix}`, orgB, 'Test Organization B', `test-b-${suffix}`],
    );
    await client.query(
      'INSERT INTO organization_memberships (id, organization_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [`membership-${suffix}`, orgA, userId, 'ORGANIZATION_OWNER'],
    );
    await client.query(
      'INSERT INTO clinics (id, organization_id, name) VALUES ($1, $2, $3), ($4, $5, $6)',
      [clinicA, orgA, 'Clinic A', clinicB, orgB, 'Clinic B'],
    );
    await client.query(
      'INSERT INTO clinic_memberships (id, organization_id, clinic_id, user_id, role) VALUES ($1, $2, $3, $4, $5)',
      [`clinic-membership-${suffix}`, orgA, clinicA, userId, 'ORGANIZATION_OWNER'],
    );
    await client.query(
      'INSERT INTO patients (id, organization_id, patient_number, first_name, last_name) VALUES ($1, $2, $3, $4, $5)',
      [patientId, orgA, `DEN-TEST-${suffix}`, 'Test', 'Patient'],
    );
    await client.query(
      'INSERT INTO patient_clinics (organization_id, patient_id, clinic_id) VALUES ($1, $2, $3)',
      [orgA, patientId, clinicA],
    );

    await client.query('SAVEPOINT expected_membership_failure');
    await assert.rejects(
      client.query(
        'INSERT INTO clinic_memberships (id, organization_id, clinic_id, user_id, role) VALUES ($1, $2, $3, $4, $5)',
        [`bad-membership-${suffix}`, orgB, clinicB, userId, 'DENTIST'],
      ),
      (error: unknown) => (error as { code?: string }).code === '23503',
      'a user cannot join a clinic in an organization where they have no organization membership',
    );
    await client.query('ROLLBACK TO SAVEPOINT expected_membership_failure');
    await client.query('RELEASE SAVEPOINT expected_membership_failure');

    await client.query('SAVEPOINT expected_odontogram_failure');
    await assert.rejects(
      client.query(
        'INSERT INTO odontogram_records (id, organization_id, clinic_id, patient_id, status_payload) VALUES ($1, $2, $3, $4, $5::jsonb)',
        [`bad-odonto-${suffix}`, orgA, clinicB, patientId, JSON.stringify({ tooth: 'test' })],
      ),
      (error: unknown) => (error as { code?: string }).code === '23503',
      'an odontogram cannot associate a patient with a clinic from another organization',
    );
    await client.query('ROLLBACK TO SAVEPOINT expected_odontogram_failure');
    await client.query('RELEASE SAVEPOINT expected_odontogram_failure');

    await client.query(
      'INSERT INTO odontogram_records (id, organization_id, clinic_id, patient_id, status_payload) VALUES ($1, $2, $3, $4, $5::jsonb)',
      [`odonto-${suffix}`, orgA, clinicA, patientId, JSON.stringify({ '11': 'healthy' })],
    );

    const readBack = await client.query(
      'SELECT status_payload FROM odontogram_records WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3',
      [orgA, clinicA, patientId],
    );
    assert.deepEqual(readBack.rows[0]?.status_payload, { '11': 'healthy' });

    await client.query('ROLLBACK');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* ignore rollback errors */ }
    throw error;
  } finally {
    client.release();
  }
});

test.after(async () => {
  await pool.end();
});
