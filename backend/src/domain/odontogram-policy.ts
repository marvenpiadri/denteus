export function hasOdontogramRevisionConflict(
  currentUpdatedAt: Date | string | null | undefined,
  expectedUpdatedAt: string | null | undefined,
): boolean {
  if (currentUpdatedAt == null) return expectedUpdatedAt != null;
  if (!expectedUpdatedAt) return true;

  const currentTime = new Date(currentUpdatedAt).getTime();
  const expectedTime = Date.parse(expectedUpdatedAt);
  return !Number.isFinite(currentTime) || !Number.isFinite(expectedTime) || currentTime !== expectedTime;
}
