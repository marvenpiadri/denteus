export function validateDatabaseConfiguration(
  connectionString: string | undefined,
  production: boolean,
): void {
  if (!connectionString?.trim()) {
    throw new Error('DATABASE_URL must be configured for the Dentaleus backend.');
  }
  if (!production) return;

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL in production.');
  }

  if (
    !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
    !databaseUrl.hostname ||
    databaseUrl.pathname.length < 2
  ) {
    throw new Error('DATABASE_URL must identify a PostgreSQL host and database in production.');
  }

  let password: string;
  try {
    password = decodeURIComponent(databaseUrl.password);
  } catch {
    throw new Error('DATABASE_URL contains invalid encoded credentials.');
  }

  if (/^(change-me|change-me-now|replace-with|replace-me|your[-_ ]|example|test[-_ ]|password)$/i.test(password)) {
    throw new Error('DATABASE_URL must not contain a placeholder database password in production.');
  }
}
