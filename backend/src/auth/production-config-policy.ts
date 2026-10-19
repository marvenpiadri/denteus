export function validateProductionAuthConfiguration(
  configuredBaseUrl: string | undefined,
  configuredOrigins: string | undefined,
): void {
  if (!configuredOrigins) {
    throw new Error('CLIENT_ORIGINS must be configured in production.');
  }

  const trustedOrigins = configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (trustedOrigins.length === 0) {
    throw new Error('At least one CLIENT_ORIGINS HTTPS origin must be configured in production.');
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(configuredBaseUrl ?? '');
  } catch {
    throw new Error('BETTER_AUTH_URL must be a valid HTTPS origin in production.');
  }

  if (
    baseUrl.protocol !== 'https:' ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.pathname !== '/' ||
    baseUrl.search ||
    baseUrl.hash ||
    baseUrl.origin !== configuredBaseUrl
  ) {
    throw new Error('BETTER_AUTH_URL must be a canonical HTTPS origin without credentials, a path, query, or fragment in production.');
  }

  for (const origin of trustedOrigins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('Every CLIENT_ORIGINS entry must be a valid HTTPS origin in production.');
    }

    if (
      parsed.protocol !== 'https:' ||
      parsed.origin !== origin ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error('Every CLIENT_ORIGINS entry must be a canonical HTTPS origin without a path or credentials in production.');
    }
  }
}
