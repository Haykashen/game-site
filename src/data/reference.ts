// Display dictionaries only. Games, editions, offers and community records come from API.
import platforms from './platforms.json';
import filters from './filters.json';
export const PLATFORMS = platforms;
export const PLATFORM_GROUPS = [...new Set(platforms.map((item) => item.group))].map((label) => ({
  label, options: platforms.filter((item) => item.group === label).map((item) => item.name),
}));
export const LANGUAGES = filters.languages;
export const REGIONS = filters.regions;
export const EDITIONS = filters.editions;
export const COMPLETENESS = filters.completeness;
export const YEAR_RANGES = filters.yearRanges.map((range) => ({ ...range, max: range.max ?? Number.POSITIVE_INFINITY }));
export function getPlatformBadgeStyle(platform: string) {
  const match = platforms.find((item) => item.name === platform);
  return match ? { backgroundColor: match.color, color: match.textColor } : undefined;
}
