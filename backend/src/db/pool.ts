import { Pool } from 'pg';

const connectionString = process.env['DATABASE_URL'];
const maxConnections = Number(process.env['DATABASE_POOL_MAX'] ?? 10);

if (!connectionString) {
  throw new Error('DATABASE_URL must be configured for the Dentaleus backend.');
}
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
  // Never log connection strings or query parameters; this is a process-level
  // signal that an idle pooled connection failed unexpectedly.
  console.error('Unexpected PostgreSQL pool error:', error.message);
});

export async function checkDatabaseConnection(): Promise<void> {
  await pool.query('SELECT 1');
}
