import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL is required for PostgreSQL integration tests.');
}
const pool = new Pool({ connectionString, max: 3 });

test('tenant constraints isolate clinics and odontogram data persists across connections', async () => {
  const suffix = randomUUID();
  const userId = `user-${suffix}`;
  const orgA = `org-a-${suffix}`;
  const orgB = `org-b-${suffix}`;
  const clinicA = `clinic-a-${suffix}`;
  const clinicA2 = `clinic-a2-${suffix}`;
  const clinicB = `clinic-b-${suffix}`;
  const patientId = `patient-${suffix}`;
  const appointmentId = `appointment-${suffix}`;

  const writer = await pool.connect();
  let committed = false;
  try {
    await writer.query('BEGIN');
    await writer.query(
      'INSERT INTO app_users (id, name, email) VALUES ($1, $2, $3)',
      [userId, 'Integration Test', `${suffix}@example.invalid`],
    );
    await writer.query(
      'INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3), ($4, $5, $6)',
      [orgA, 'Test Organization A', `test-a-${suffix}`, orgB, 'Test Organization B', `test-b-${suffix}`],
    );
    await writer.query(
      'INSERT INTO organization_memberships (id, organization_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [`membership-${suffix}`, orgA, userId, 'ORGANIZATION_OWNER'],
    );
    await writer.query(
      'INSERT INTO clinics (id, organization_id, name) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9)',
      [clinicA, orgA, 'Clinic A', clinicA2, orgA, 'Clinic A2', clinicB, orgB, 'Clinic B'],
    );
    await writer.query(
      'INSERT INTO clinic_memberships (id, organization_id, clinic_id, user_id, role) VALUES ($1, $2, $3, $4, $5)',
      [`clinic-membership-${suffix}`, orgA, clinicA, userId, 'ORGANIZATION_OWNER'],
    );
    await writer.query(
      'INSERT INTO patients (id, organization_id, patient_number, first_name, last_name) VALUES ($1, $2, $3, $4, $5)',
      [patientId, orgA, `DEN-TEST-${suffix}`, 'Test', 'Patient'],
    );
    await writer.query(
      'INSERT INTO patient_clinics (organization_id, patient_id, clinic_id) VALUES ($1, $2, $3)',
      [orgA, patientId, clinicA],
    );

    await writer.query('SAVEPOINT expected_membership_failure');
    await assert.rejects(
      writer.query(
        'INSERT INTO clinic_memberships (id, organization_id, clinic_id, user_id, role) VALUES ($1, $2, $3, $4, $5)',
        [`bad-membership-${suffix}`, orgB, clinicB, userId, 'DENTIST'],
      ),
      (error: unknown) => (error as { code?: string }).code === '23503',
      'a user cannot join a clinic in an organization where they have no organization membership',
    );
    await writer.query('ROLLBACK TO SAVEPOINT expected_membership_failure');
    await writer.query('RELEASE SAVEPOINT expected_membership_failure');

    await writer.query('SAVEPOINT expected_odontogram_failure');
    await assert.rejects(
      writer.query(
        'INSERT INTO odontogram_records (id, organization_id, clinic_id, patient_id, status_payload) VALUES ($1, $2, $3, $4, $5::jsonb)',
        [`bad-odonto-${suffix}`, orgA, clinicA2, patientId, JSON.stringify({ tooth: 'test' })],
      ),
      (error: unknown) => (error as { code?: string }).code === '23503',
      'a patient chart cannot be attached to a clinic without a patient-clinic link',
    );
    await writer.query('ROLLBACK TO SAVEPOINT expected_odontogram_failure');
    await writer.query('RELEASE SAVEPOINT expected_odontogram_failure');

    await writer.query(
      'INSERT INTO odontogram_records (id, organization_id, clinic_id, patient_id, status_payload) VALUES ($1, $2, $3, $4, $5::jsonb)',
      [`odonto-${suffix}`, orgA, clinicA, patientId, JSON.stringify({ '11': 'healthy' })],
    );
    await writer.query(
      `INSERT INTO appointments (
        id, organization_id, clinic_id, patient_id, starts_at, ends_at, reason, created_by_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        appointmentId,
        orgA,
        clinicA,
        patientId,
        '2026-10-17T09:00:00.000Z',
        '2026-10-17T09:30:00.000Z',
        'Integration test',
        userId,
      ],
    );

    await writer.query('SAVEPOINT expected_appointment_scope_failure');
    await assert.rejects(
      writer.query(
        `INSERT INTO appointments (
          id, organization_id, clinic_id, patient_id, starts_at, ends_at
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `bad-appointment-${suffix}`,
          orgA,
          clinicA2,
          patientId,
          '2026-10-17T10:00:00.000Z',
          '2026-10-17T10:30:00.000Z',
        ],
      ),
      (error: unknown) => (error as { code?: string }).code === '23503',
      'an appointment cannot attach a patient to a clinic without a patient-clinic link',
    );
    await writer.query('ROLLBACK TO SAVEPOINT expected_appointment_scope_failure');
    await writer.query('RELEASE SAVEPOINT expected_appointment_scope_failure');

    await writer.query('COMMIT');
    committed = true;

    // A new pooled connection proves the data was committed and is not just
    // visible inside the transaction that wrote it.
    const reader = await pool.connect();
    try {
      const readBack = await reader.query(
        'SELECT status_payload FROM odontogram_records WHERE organization_id = $1 AND clinic_id = $2 AND patient_id = $3',
        [orgA, clinicA, patientId],
      );
      assert.deepEqual(readBack.rows[0]?.status_payload, { '11': 'healthy' });

      const appointmentReadBack = await reader.query(
        'SELECT status, reason FROM appointments WHERE organization_id = $1 AND clinic_id = $2 AND id = $3',
        [orgA, clinicA, appointmentId],
      );
      assert.equal(appointmentReadBack.rows[0]?.status, 'SCHEDULED');
      assert.equal(appointmentReadBack.rows[0]?.reason, 'Integration test');
    } finally {
      reader.release();
    }
  } finally {
    if (!committed) {
      try { await writer.query('ROLLBACK'); } catch { /* ignore rollback errors */ }
    }
    writer.release();
    // Ensure committed test fixtures are removed even if an assertion fails.
    await pool.query('DELETE FROM organizations WHERE id = ANY($1::text[])', [[orgA, orgB]]);
    await pool.query('DELETE FROM app_users WHERE id = $1', [userId]);
  }
});

test.after(async () => {
  await pool.end();
});
