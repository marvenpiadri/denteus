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
  const recallId = `recall-${suffix}`;
  const providerId = `provider-${suffix}`;
  const operatoryId = `operatory-${suffix}`;
  const treatmentId = `treatment-${suffix}`;

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
      `INSERT INTO odontogram_revisions (
        id, organization_id, clinic_id, patient_id, odontogram_id, version_no, snapshot, recorded_by_id
      ) VALUES ($1, $2, $3, $4, $5, 1, $6::jsonb, $7)`,
      [`odonto-revision-${suffix}`, orgA, clinicA, patientId, `odonto-${suffix}`, JSON.stringify({ status: { '11': 'healthy' }, plan: null, planChanges: [], extra: {} }), userId],
    );

    await writer.query('SAVEPOINT expected_odontogram_revision_scope_failure');
    await assert.rejects(
      writer.query(
        `INSERT INTO odontogram_revisions (
          id, organization_id, clinic_id, patient_id, odontogram_id, version_no, snapshot, recorded_by_id
        ) VALUES ($1, $2, $3, $4, $5, 2, $6::jsonb, $7)`,
        [`bad-odonto-revision-${suffix}`, orgA, clinicA2, patientId, `odonto-${suffix}`, JSON.stringify({ status: {} }), userId],
      ),
      (error: unknown) => (error as { code?: string }).code === '23503',
      'an odontogram revision cannot be attached to a different clinic',
    );
    await writer.query('ROLLBACK TO SAVEPOINT expected_odontogram_revision_scope_failure');
    await writer.query('RELEASE SAVEPOINT expected_odontogram_revision_scope_failure');
    await writer.query(
      `INSERT INTO clinic_providers (id, organization_id, clinic_id, display_name, role)
       VALUES ($1, $2, $3, $4, 'DENTIST')`,
      [providerId, orgA, clinicA, 'Integration Dentist'],
    );
    await writer.query(
      `INSERT INTO clinic_operatories (id, organization_id, clinic_id, name, chair_number)
       VALUES ($1, $2, $3, $4, 1)`,
      [operatoryId, orgA, clinicA, 'Integration Chair'],
    );
    await writer.query(
      `INSERT INTO provider_working_hours (id, organization_id, clinic_id, provider_id, day_of_week, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, 6, '09:00', '18:00')`,
      [`provider-hours-${suffix}`, orgA, clinicA, providerId],
    );
    await writer.query(
      `INSERT INTO appointments (
        id, organization_id, clinic_id, patient_id, starts_at, ends_at, reason, created_by_id, provider_id, operatory_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        appointmentId,
        orgA,
        clinicA,
        patientId,
        '2026-10-17T09:00:00.000Z',
        '2026-10-17T09:30:00.000Z',
        'Integration test',
        userId,
        providerId,
        operatoryId,
      ],
    );
    await writer.query(
      `INSERT INTO patient_treatments (
        id, organization_id, clinic_id, patient_id, appointment_id, title, category, status,
        performed_at, performed_by_id, recorded_by_id
      ) VALUES ($1, $2, $3, $4, $5, 'Composite restoration', 'RESTORATIVE', 'COMPLETED', now(), $6, $6)`,
      [treatmentId, orgA, clinicA, patientId, appointmentId, userId],
    );
    await writer.query(
      `INSERT INTO patient_treatment_teeth (id, organization_id, clinic_id, treatment_id, tooth_no, surface)
       VALUES ($1, $2, $3, $4, 36, 'OCCLUSAL')`,
      [`treatment-tooth-${suffix}`, orgA, clinicA, treatmentId],
    );
    await writer.query(
      `INSERT INTO patient_treatment_events (id, organization_id, clinic_id, patient_id, treatment_id, actor_id, action, to_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'CREATED', 'COMPLETED')`,
      [`treatment-event-${suffix}`, orgA, clinicA, patientId, treatmentId, userId],
    );

    await writer.query(
      `INSERT INTO patient_recalls (id, organization_id, clinic_id, patient_id, recall_type, due_on, interval_months, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8)`,
      [recallId, orgA, clinicA, patientId, 'Periodic check-up', '2026-10-17', 6, userId],
    );
    await writer.query(
      `INSERT INTO patient_recall_events (id, organization_id, clinic_id, recall_id, user_id, event_type, to_status)
       VALUES ($1, $2, $3, $4, $5, 'CREATED', 'DUE')`,
      [`recall-event-${suffix}`, orgA, clinicA, recallId, userId],
    );

    await writer.query('SAVEPOINT expected_recall_scope_failure');
    await assert.rejects(
      writer.query(
        `INSERT INTO patient_recall_events (id, organization_id, clinic_id, recall_id, user_id, event_type)
         VALUES ($1, $2, $3, $4, $5, 'NOTE_ADDED')`,
        [`bad-recall-event-${suffix}`, orgA, clinicA2, recallId, userId],
      ),
      (error: unknown) => (error as { code?: string }).code === '23503',
      'recall history cannot be attached to a different clinic',
    );
    await writer.query('ROLLBACK TO SAVEPOINT expected_recall_scope_failure');
    await writer.query('RELEASE SAVEPOINT expected_recall_scope_failure');

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

    // Even when the same patient is linked to two clinics, treatment events must stay with their treatment's clinic.
    await writer.query(
      'INSERT INTO patient_clinics (organization_id, patient_id, clinic_id) VALUES ($1, $2, $3)',
      [orgA, patientId, clinicA2],
    );
    await writer.query('SAVEPOINT expected_resource_scope_failure');
    await assert.rejects(
      writer.query(
        `INSERT INTO appointments (
          id, organization_id, clinic_id, patient_id, starts_at, ends_at, provider_id, operatory_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [`bad-resource-appointment-${suffix}`, orgA, clinicA2, patientId,
          '2026-10-17T10:00:00.000Z', '2026-10-17T10:30:00.000Z', providerId, operatoryId],
      ),
      (error: unknown) => (error as { code?: string }).code === '23503',
      'an appointment cannot use a provider or chair from another clinic',
    );
    await writer.query('ROLLBACK TO SAVEPOINT expected_resource_scope_failure');
    await writer.query('RELEASE SAVEPOINT expected_resource_scope_failure');

    await writer.query('SAVEPOINT expected_treatment_scope_failure');
    await assert.rejects(
      writer.query(
        `INSERT INTO patient_treatment_events (id, organization_id, clinic_id, patient_id, treatment_id, actor_id, action, to_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'STATUS_CHANGED', 'COMPLETED')`,
        [`bad-treatment-event-${suffix}`, orgA, clinicA2, patientId, treatmentId, userId],
      ),
      (error: unknown) => (error as { code?: string }).code === '23503',
      'a treatment event cannot be attached to the same patient in a different clinic',
    );
    await writer.query('ROLLBACK TO SAVEPOINT expected_treatment_scope_failure');
    await writer.query('RELEASE SAVEPOINT expected_treatment_scope_failure');

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
      const assignedResources = await reader.query(
        `SELECT a.provider_id AS "providerId", p.display_name AS "providerName",
                a.operatory_id AS "operatoryId", o.name AS "operatoryName"
         FROM appointments a
         JOIN clinic_providers p ON p.organization_id = a.organization_id AND p.clinic_id = a.clinic_id AND p.id = a.provider_id
         JOIN clinic_operatories o ON o.organization_id = a.organization_id AND o.clinic_id = a.clinic_id AND o.id = a.operatory_id
         WHERE a.organization_id = $1 AND a.clinic_id = $2 AND a.id = $3`,
        [orgA, clinicA, appointmentId],
      );
      assert.equal(assignedResources.rows[0]?.providerId, providerId);
      assert.equal(assignedResources.rows[0]?.operatoryId, operatoryId);

      const treatmentReadBack = await reader.query(
        `SELECT pt.status, pt.title, ts.tooth_no AS "toothNo", ts.surface
         FROM patient_treatments pt
         JOIN patient_treatment_teeth ts ON ts.organization_id = pt.organization_id AND ts.clinic_id = pt.clinic_id AND ts.treatment_id = pt.id
         WHERE pt.organization_id = $1 AND pt.clinic_id = $2 AND pt.id = $3`,
        [orgA, clinicA, treatmentId],
      );
      assert.equal(treatmentReadBack.rows[0]?.status, 'COMPLETED');
      assert.equal(treatmentReadBack.rows[0]?.title, 'Composite restoration');
      assert.equal(treatmentReadBack.rows[0]?.toothNo, 36);
      assert.equal(treatmentReadBack.rows[0]?.surface, 'OCCLUSAL');

      const recallReadBack = await reader.query(
        'SELECT status, recall_type FROM patient_recalls WHERE organization_id = $1 AND clinic_id = $2 AND id = $3',
        [orgA, clinicA, recallId],
      );
      assert.equal(recallReadBack.rows[0]?.status, 'DUE');
      assert.equal(recallReadBack.rows[0]?.recall_type, 'Periodic check-up');
      const recallEventReadBack = await reader.query(
        'SELECT event_type, to_status FROM patient_recall_events WHERE organization_id = $1 AND clinic_id = $2 AND recall_id = $3',
        [orgA, clinicA, recallId],
      );
      assert.equal(recallEventReadBack.rows[0]?.event_type, 'CREATED');
      assert.equal(recallEventReadBack.rows[0]?.to_status, 'DUE');
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
