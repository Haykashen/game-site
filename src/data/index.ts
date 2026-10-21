import { MAX_MARKET_PHOTOS } from '../lib/constants';
import { isDeliveryService } from '../lib/delivery';
import { parseGames } from '../lib/storage';
import type { Game, Lot, MarketEntry } from '../types';
import filtersJson from './filters.json';
import gamesJson from './games.json';
import lotsJson from './lots.json';
import marketJson from './market.json';
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
  readonly regions: readonly string[];
  readonly editions: readonly string[];
  readonly completeness: readonly string[];
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
/** JSON strings and service ids are validated at startup before being narrowed. */
type MarketSeed = Omit<MarketEntry, 'kind' | 'deliveryServices'> & {
  readonly kind: string;
  readonly deliveryServices: readonly string[];
};

// Explicit annotations make JSON edits fail typechecking if a required field is lost.
const filtersData: FiltersData = filtersJson;
const gameSeeds: readonly GameSeed[] = gamesJson;
const lotSeeds: readonly LotSeed[] = lotsJson;
const marketSeeds: readonly MarketSeed[] = marketJson;

export const PLATFORMS: readonly PlatformDefinition[] = platformsJson;

export const PLATFORM_GROUPS: readonly OptionGroup[] = groupPlatforms(PLATFORMS);

export const LANGUAGES: readonly string[] = filtersData.languages;

export const REGIONS: readonly string[] = filtersData.regions;

export const EDITIONS: readonly string[] = filtersData.editions;

export const COMPLETENESS: readonly string[] = filtersData.completeness;

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
const regionNames = new Set(REGIONS);
const editionNames = new Set(EDITIONS);
const completenessNames = new Set(COMPLETENESS);

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

  if (!regionNames.has(game.region)) {
    throw new Error(
      `Неизвестный регион «${game.region}» в src/data/games.json. Добавьте его в filters.json.`,
    );
  }

  if (!editionNames.has(game.edition)) {
    throw new Error(
      `Неизвестное издание «${game.edition}» в src/data/games.json. Добавьте его в filters.json.`,
    );
  }

  if (!completenessNames.has(game.completeness)) {
    throw new Error(
      `Неизвестная комплектность «${game.completeness}» в src/data/games.json. Добавьте её в filters.json.`,
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

const gameIds = new Set(gameSeeds.map((game) => game.id));

for (const entry of marketSeeds) {
  if (entry.kind !== 'listing' && entry.kind !== 'auction') {
    throw new Error(`Неизвестный тип «${entry.kind}» в src/data/market.json.`);
  }

  if (!gameIds.has(entry.gameId)) {
    throw new Error(
      `Неизвестная игра «${entry.gameId}» в src/data/market.json. Добавьте её в games.json.`,
    );
  }

  if (
    !entry.title.trim() ||
    !entry.edition.trim() ||
    !entry.region.trim() ||
    !entry.condition.trim() ||
    !entry.seller.trim() ||
    !entry.description.trim()
  ) {
    throw new Error(`Заполните текстовые поля записи «${entry.id}» в src/data/market.json.`);
  }

  if (!EDITIONS.includes(entry.edition) || !REGIONS.includes(entry.region)) {
    throw new Error(
      `Проверьте edition и region в записи «${entry.id}» в src/data/market.json: значения должны быть из filters.json.`,
    );
  }

  if (!Number.isFinite(entry.price) || entry.price <= 0) {
    throw new Error(`Некорректная цена в записи «${entry.id}» в src/data/market.json.`);
  }

  if (
    !Array.isArray(entry.photos) ||
    entry.photos.length > MAX_MARKET_PHOTOS ||
    entry.photos.some(
      (photo) => typeof photo !== 'string' || !photo.startsWith('data:image/'),
    )
  ) {
    throw new Error(
      `Проверьте поле photos в записи «${entry.id}» в src/data/market.json: допускается до ${MAX_MARKET_PHOTOS} data-URL изображений.`,
    );
  }

  if (
    !Array.isArray(entry.deliveryServices) ||
    entry.deliveryServices.length === 0 ||
    entry.deliveryServices.some((service) => !isDeliveryService(service)) ||
    new Set(entry.deliveryServices).size !== entry.deliveryServices.length
  ) {
    throw new Error(
      `Проверьте поле deliveryServices в записи «${entry.id}» в src/data/market.json: нужен непустой список без повторов из russian-post, cdek, yandex, other.`,
    );
  }

  if (typeof entry.internationalShipping !== 'boolean') {
    throw new Error(
      `Поле internationalShipping в записи «${entry.id}» в src/data/market.json должно быть true или false.`,
    );
  }

  if (
    entry.packagingPrice === null ||
    !Number.isInteger(entry.packagingPrice) ||
    entry.packagingPrice < 0
  ) {
    throw new Error(
      `Поле packagingPrice в записи «${entry.id}» в src/data/market.json должно быть неотрицательным целым числом.`,
    );
  }

  if (!entry.shipsFrom.trim() || entry.shipsFrom.length > 80) {
    throw new Error(
      `Поле shipsFrom в записи «${entry.id}» в src/data/market.json должно содержать город или регион отправки (до 80 символов).`,
    );
  }

  if (!Number.isInteger(entry.bids) || entry.bids < 0) {
    throw new Error(`Некорректное число ставок в записи «${entry.id}» в src/data/market.json.`);
  }

  if (entry.kind === 'auction') {
    if (entry.bidStep === null || !Number.isInteger(entry.bidStep) || entry.bidStep <= 0) {
      throw new Error(
        `Аукцион «${entry.id}» в src/data/market.json должен иметь положительный целый bidStep.`,
      );
    }

    if (entry.startsAt === null || Number.isNaN(Date.parse(entry.startsAt))) {
      throw new Error(`Аукцион «${entry.id}» в src/data/market.json должен иметь дату открытия.`);
    }

    if (entry.endsAt === null || Number.isNaN(Date.parse(entry.endsAt))) {
      throw new Error(`Аукцион «${entry.id}» в src/data/market.json должен иметь дату окончания.`);
    }

    if (Date.parse(entry.startsAt) >= Date.parse(entry.endsAt)) {
      throw new Error(
        `У аукциона «${entry.id}» в src/data/market.json дата окончания должна быть позже даты открытия.`,
      );
    }
  }

  if (
    entry.kind === 'listing' &&
    (entry.endsAt !== null || entry.startsAt !== null || entry.bidStep !== null)
  ) {
    throw new Error(
      `У объявления «${entry.id}» в src/data/market.json не должно быть дат торгов и шага цены.`,
    );
  }

  if (Number.isNaN(Date.parse(entry.createdAt))) {
    throw new Error(`Некорректная дата создания в записи «${entry.id}» в src/data/market.json.`);
  }
}

/** Demo marketplace entries; user-created ones are merged on top from localStorage. */
export const INITIAL_MARKET_ENTRIES: MarketEntry[] = marketSeeds.map((entry) => {
  if (entry.kind !== 'listing' && entry.kind !== 'auction') {
    throw new Error(`Неизвестный тип «${entry.kind}» в src/data/market.json.`);
  }

  return {
    ...entry,
    kind: entry.kind,
    deliveryServices: entry.deliveryServices.filter(isDeliveryService),
  };
});
