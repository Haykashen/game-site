/** Preserve shared/bookmarked links from the previous hash router. */
export function legacyRoutePath(hash: string): string | null {
  if (!hash.startsWith('#/') || hash.startsWith('#//')) return null;
  return hash.slice(1);
}
