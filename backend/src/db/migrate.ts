import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';
import { safeErrorLogFields } from '../security/safe-error-log.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(currentDirectory, 'migrations');

async function migrate(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [741_092_611]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const baseline = await client.query(
      "SELECT 1 FROM schema_migrations WHERE name = '001_initial_schema.sql'",
    );

    if (!baseline.rowCount) {
      const previousMigrations = await client.query(
        'SELECT count(*)::integer AS count FROM schema_migrations',
      );
      const existingSchema = await client.query(
        "SELECT to_regclass('public.app_users') AS app_users, to_regclass('public.organizations') AS organizations",
      );
      if (
        previousMigrations.rows[0]?.count > 0 ||
        existingSchema.rows[0]?.app_users !== null ||
        existingSchema.rows[0]?.organizations !== null
      ) {
        throw new Error(
          'This database already contains a previous Denteus schema. The clean baseline only runs on an empty database; create a fresh Neon database before applying it.',
        );
      }
    }

    const files = (await readdir(migrationsDirectory))
      .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name))
      .sort();

    for (const name of files) {
      const alreadyApplied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE name = $1',
        [name],
      );
      if (alreadyApplied.rowCount) continue;

      const sql = await readFile(join(migrationsDirectory, name), 'utf8');
      console.info(`Applying migration ${name}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.info('Database migrations are up to date.');
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [741_092_611]);
    } finally {
      client.release();
      await pool.end();
    }
  }
}

migrate().catch((error: unknown) => {
  console.error('Database migration failed:', safeErrorLogFields(error));
  process.exitCode = 1;
});
