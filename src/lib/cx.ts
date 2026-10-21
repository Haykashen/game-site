/** Joins conditional class names without pulling in an extra dependency. */
export function cx(...values: ReadonlyArray<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
