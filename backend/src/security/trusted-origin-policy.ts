export function isTrustedMutationOrigin(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  if (!origin || origin === 'null') return false;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.origin !== origin ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    return false;
  }

  return allowedOrigins.includes(origin);
}
