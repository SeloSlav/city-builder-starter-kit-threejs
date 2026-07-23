export function surfaceRockCountForRemaining(
  capacity: number,
  remaining: number,
  maxYield: number,
): number {
  if (capacity <= 0 || maxYield <= 0 || remaining <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, remaining / maxYield));
  return Math.min(capacity, Math.max(0, Math.ceil(capacity * ratio - 1e-6)));
}
