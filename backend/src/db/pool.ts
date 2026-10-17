import { Pool } from 'pg';

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('DATABASE_URL must be configured for the Dentaleus backend.');
}

export const pool = new Pool({
  connectionString,
  max: Number(process.env['DATABASE_POOL_MAX'] ?? 10),
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
