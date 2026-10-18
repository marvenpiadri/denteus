export function hasOdontogramRevisionConflict(
  currentUpdatedAt: Date | string | null | undefined,
  expectedUpdatedAt: string | null | undefined,
): boolean {
  if (currentUpdatedAt == null) return expectedUpdatedAt != null;
  if (!expectedUpdatedAt) return true;

  if (typeof currentUpdatedAt === 'string') {
    // The API returns PostgreSQL's full microsecond precision, so compare the
    // opaque revision token exactly instead of truncating it through Date.
    return currentUpdatedAt !== expectedUpdatedAt;
  }

  const currentTime = currentUpdatedAt.getTime();
  const expectedTime = Date.parse(expectedUpdatedAt);
  return !Number.isFinite(currentTime) || !Number.isFinite(expectedTime) || currentTime !== expectedTime;
}
