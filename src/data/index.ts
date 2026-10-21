import { parseGames } from '../lib/storage';
import type { Game, Lot } from '../types';
import filtersJson from './filters.json';
import gamesJson from './games.json';
import lotsJson from './lots.json';
import platformsJson from './platforms.json';

export interface PlatformDefinition {
  readonly name: string;
  readonly group: string;
  readonly color: string;
  readonly textColor: string;
}

export interface OptionGroup {
  readonly label: string;
  readonly options: readonly string[];
}

export interface YearRange {
  readonly value: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
}

export interface PlatformBadgeStyle {
  readonly backgroundColor: string;
  readonly color: string;
}

interface FiltersData {
  readonly languages: readonly string[];
  readonly yearRanges: readonly {
    readonly value: string;
    readonly label: string;
    readonly min: number;
    readonly max: number | null;
  }[];
}

type GameSeed = Omit<Game, 'lots'>;
type LotSeed = Omit<Lot, 'type'> & {
  readonly gameId: string;
  readonly type: string;
};

// Explicit annotations make JSON edits fail typechecking if a required field is lost.
const filtersData: FiltersData = filtersJson;
const gameSeeds: readonly GameSeed[] = gamesJson;
const lotSeeds: readonly LotSeed[] = lotsJson;

export const PLATFORMS: readonly PlatformDefinition[] = platformsJson;

export const PLATFORM_GROUPS: readonly OptionGroup[] = groupPlatforms(PLATFORMS);

export const LANGUAGES: readonly string[] = filtersData.languages;

export const YEAR_RANGES: readonly YearRange[] = filtersData.yearRanges.map((range) => ({
  value: range.value,
  label: range.label,
  min: range.min,
  max: range.max ?? Number.POSITIVE_INFINITY,
}));

const platformByName = new Map(PLATFORMS.map((platform) => [platform.name, platform]));

function groupPlatforms(platforms: readonly PlatformDefinition[]): OptionGroup[] {
  const groups = new Map<string, string[]>();

  for (const platform of platforms) {
    const options = groups.get(platform.group);

    if (options) {
      options.push(platform.name);
    } else {
      groups.set(platform.group, [platform.name]);
    }
  }

  return Array.from(groups, ([label, options]) => ({ label, options }));
}

/** Platform badge colours live in platforms.json, so UI and data stay in sync. */
export function getPlatformBadgeStyle(platform: string): PlatformBadgeStyle | undefined {
  const match = platformByName.get(platform);

  return match ? { backgroundColor: match.color, color: match.textColor } : undefined;
}

const platformNames = new Set(PLATFORMS.map((platform) => platform.name));
const languageNames = new Set(LANGUAGES);

for (const game of gameSeeds) {
  if (!platformNames.has(game.platform)) {
    throw new Error(
      `Неизвестная платформа «${game.platform}» в src/data/games.json. Добавьте её в platforms.json.`,
    );
  }

  if (!languageNames.has(game.lang)) {
    throw new Error(
      `Неизвестный язык «${game.lang}» в src/data/games.json. Добавьте его в filters.json.`,
    );
  }
}

const lotsByGame = new Map<string, unknown[]>();

for (const lot of lotSeeds) {
  const { gameId, ...lotData } = lot;
  const gameLots = lotsByGame.get(gameId);

  if (gameLots) {
    gameLots.push(lotData);
  } else {
    lotsByGame.set(gameId, [lotData]);
  }
}

const parsedGames = parseGames(
  gameSeeds.map((game) => ({
    ...game,
    lots: lotsByGame.get(game.id) ?? [],
  })),
);

if (parsedGames === null) {
  throw new Error('Не удалось прочитать список игр из src/data/games.json');
}

const parsedLotCount = parsedGames.reduce((total, game) => total + game.lots.length, 0);

if (parsedGames.length !== gameSeeds.length || parsedLotCount !== lotSeeds.length) {
  throw new Error(
    'Проверьте обязательные поля и gameId в src/data/games.json и src/data/lots.json',
  );
}

export const INITIAL_GAMES: Game[] = parsedGames;
