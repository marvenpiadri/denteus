import { Pool } from 'pg';
import { safeErrorLogFields } from '../security/safe-error-log.js';
import { validateDatabaseConfiguration } from './database-config-policy.js';

const connectionString = process.env['DATABASE_URL'];
const maxConnections = Number(process.env['DATABASE_POOL_MAX'] ?? 10);

validateDatabaseConfiguration(connectionString, process.env['NODE_ENV'] === 'production');
if (!Number.isInteger(maxConnections) || maxConnections < 1 || maxConnections > 100) {
  throw new Error('DATABASE_POOL_MAX must be an integer between 1 and 100.');
}

export const pool = new Pool({
  connectionString,
  max: maxConnections,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: 'dentaleus-api',
});

pool.on('error', (error) => {
  // Pool errors can carry connection details. Keep diagnostics structured and
  // omit free-form messages, query details, and stack traces.
  console.error('Unexpected PostgreSQL pool error:', safeErrorLogFields(error));
});

export async function checkDatabaseConnection(): Promise<void> {
  await pool.query('SELECT 1');
}
