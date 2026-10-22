export function ratingFrom(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round((sum / count) * 100) / 100;
}
