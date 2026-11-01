// Display dictionaries only. Games, editions, offers and community records come from API.
import platforms from './platforms.json';
import filters from './filters.json';
export const PLATFORMS = platforms;
// Each family is stored oldest first in the dictionary; display newest first.
const PLATFORM_DISPLAY_ORDER = ['PlayStation', 'Xbox', 'Nintendo'].flatMap(group =>
  platforms.filter(platform => platform.group === group).map(platform => platform.name).reverse(),
);
const platformRank = new Map(PLATFORM_DISPLAY_ORDER.map((name, index) => [name, index]));
export function sortPlatforms(names: readonly string[]): string[] {
  return [...new Set(names)].sort((left, right) =>
    (platformRank.get(left) ?? PLATFORM_DISPLAY_ORDER.length) -
    (platformRank.get(right) ?? PLATFORM_DISPLAY_ORDER.length) ||
    left.localeCompare(right, 'ru', {numeric: true}),
  );
}
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
