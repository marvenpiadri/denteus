import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL integration tests.');
const pool = new Pool({ connectionString, max: 2 });

test('organization invitations prevent duplicate pending emails but allow replacement after revocation', async () => {
  const suffix = randomUUID();
  const userId = 'invite-owner-' + suffix;
  const organizationId = 'invite-org-' + suffix;
  const invitationId = 'invite-a-' + suffix;
  const duplicateId = 'invite-b-' + suffix;
  const replacementId = 'invite-c-' + suffix;
  const email = suffix + '@example.invalid';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO app_users (id, name, email) VALUES ($1,$2,$3)', [userId, 'Invite Owner', 'owner-' + email]);
    await client.query('INSERT INTO organizations (id, name, slug) VALUES ($1,$2,$3)', [organizationId, 'Invitation Test', 'invite-test-' + suffix]);
    await client.query(
      "INSERT INTO organization_memberships (id, organization_id, user_id, role) VALUES ($1,$2,$3,'ORGANIZATION_OWNER')",
      ['membership-' + suffix, organizationId, userId],
    );
    const invitationSql = `INSERT INTO organization_invitations
      (id, organization_id, invited_email, role, clinic_ids, token_hash, invited_by_id, expires_at)
      VALUES ($1,$2,$3,'DENTIST','[]'::jsonb,$4,$5,now()+interval '7 days')`;
    await client.query(invitationSql, [invitationId, organizationId, email, 'hash-a-' + suffix, userId]);
    await client.query('SAVEPOINT duplicate_invitation');
    await assert.rejects(
      client.query(invitationSql, [duplicateId, organizationId, email, 'hash-b-' + suffix, userId]),
      (error: unknown) => (error as { code?: string }).code === '23505',
      'a second pending invitation for the same email must be rejected',
    );
    await client.query('ROLLBACK TO SAVEPOINT duplicate_invitation');
    await client.query('RELEASE SAVEPOINT duplicate_invitation');
    await client.query('UPDATE organization_invitations SET revoked_at=now() WHERE id=$1', [invitationId]);
    await client.query(invitationSql, [replacementId, organizationId, email, 'hash-c-' + suffix, userId]);
    const result = await client.query(
      "SELECT count(*)::integer AS count FROM organization_invitations WHERE organization_id=$1 AND invited_email=$2 AND accepted_at IS NULL AND revoked_at IS NULL",
      [organizationId, email],
    );
    assert.equal(result.rows[0].count, 1);
    await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

test.after(async () => { await pool.end(); });
