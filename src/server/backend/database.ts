import { Pool } from 'pg';

const connectionString = process.env['DATABASE_URL'];

let poolInstance: Pool | undefined;

/**
 * Legacy Express API database helper kept only during the frontend/API split.
 * New backend code must import the pool from backend/src/db/pool.ts instead.
 */
export function getPool(): Pool {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString,
      max: Number(process.env['DATABASE_POOL_MAX'] ?? 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: 'dentaleus-legacy-ssr',
    });
  }

  return poolInstance;
}

export async function checkDatabaseConnection(): Promise<void> {
  await getPool().query('SELECT 1');
}

export async function disconnectDatabase(): Promise<void> {
  if (poolInstance) {
    const pool = poolInstance;
    poolInstance = undefined;
    await pool.end();
  }
}
