export function getElapsedSecondsSince(startTime: number | null): number {
  if (startTime === null) {
    return 0;
  }

  return Math.round((Date.now() - startTime) / 1000);
}
