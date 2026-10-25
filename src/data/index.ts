import { MAX_MARKET_PHOTOS } from '../lib/constants';
import { marketItemTypeSchema } from '@discvault/shared';
import { isDeliveryService } from '../lib/delivery';
import { parseEditions, parseGames } from '../lib/storage';
import type { Edition, Game, MarketEntry } from '../types';
import editionsJson from './editions.json';
import filtersJson from './filters.json';
import gamesJson from './games.json';
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

/** JSON strings and service ids are validated at startup before being narrowed. */
type MarketSeed = Omit<
  MarketEntry,
  'kind' | 'deliveryServices' | 'listingType' | 'status' | 'itemType'
> & {
  readonly itemType?: string;
  readonly kind: string;
  readonly deliveryServices: readonly string[];
  readonly listingType: string | null;
};

function isMarketListingType(value: string | null): value is MarketEntry['listingType'] {
  return value === 'sale' || value === 'purchase' || value === 'exchange' || value === null;
}

// Explicit annotations make JSON edits fail typechecking if a required field is lost.
const filtersData: FiltersData = filtersJson;
const gameSeeds: readonly Game[] = gamesJson;
const editionSeeds: readonly Edition[] = editionsJson;
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

const parsedGames = parseGames(gameSeeds);

if (parsedGames === null || parsedGames.length !== gameSeeds.length) {
  throw new Error(
    'Проверьте обязательные поля в src/data/games.json: нужны id, title, publisher, year, description, genres, coverImage.',
  );
}

export const INITIAL_GAMES: Game[] = parsedGames;

const gameIds = new Set(parsedGames.map((game) => game.id));

const parsedEditions = parseEditions(editionSeeds);

if (parsedEditions === null || parsedEditions.length !== editionSeeds.length) {
  throw new Error(
    'Проверьте обязательные поля в src/data/editions.json: нужны id, gameId, name, platform, region, lang, media.',
  );
}

const editionIds = new Set<string>();
const dnsProductIds = new Set<string>();

for (const edition of parsedEditions) {
  if (editionIds.has(edition.id)) {
    throw new Error(`Повторяющийся id издания «${edition.id}» в src/data/editions.json.`);
  }
  editionIds.add(edition.id);

  if (edition.dnsProductId) {
    if (dnsProductIds.has(edition.dnsProductId)) {
      throw new Error(
        `DNS data-product «${edition.dnsProductId}» указан у нескольких изданий: одно издание должно ссылаться на одну карточку товара.`,
      );
    }
    dnsProductIds.add(edition.dnsProductId);
  }

  if (!gameIds.has(edition.gameId)) {
    throw new Error(
      `Неизвестная игра «${edition.gameId}» у издания «${edition.id}» в src/data/editions.json.`,
    );
  }

  if (!platformNames.has(edition.platform)) {
    throw new Error(
      `Неизвестная платформа «${edition.platform}» у издания «${edition.id}» в src/data/editions.json.`,
    );
  }

  if (!languageNames.has(edition.lang)) {
    throw new Error(
      `Неизвестный язык «${edition.lang}» у издания «${edition.id}» в src/data/editions.json.`,
    );
  }

  if (!regionNames.has(edition.region)) {
    throw new Error(
      `Неизвестный регион «${edition.region}» у издания «${edition.id}» в src/data/editions.json.`,
    );
  }

  if (!editionNames.has(edition.name)) {
    throw new Error(
      `Неизвестное издание «${edition.name}» у записи «${edition.id}» в src/data/editions.json.`,
    );
  }
}

export const INITIAL_EDITIONS: Edition[] = parsedEditions;

const editionById = new Map(parsedEditions.map((edition) => [edition.id, edition]));

for (const entry of marketSeeds) {
  if (entry.kind !== 'listing' && entry.kind !== 'auction') {
    throw new Error(`Неизвестный тип «${entry.kind}» в src/data/market.json.`);
  }

  if (
    entry.kind === 'auction'
      ? entry.listingType !== null
      : entry.listingType !== 'sale' &&
        entry.listingType !== 'purchase' &&
        entry.listingType !== 'exchange'
  ) {
    throw new Error(
      `Проверьте listingType в записи «${entry.id}» в src/data/market.json: у объявления должен быть sale, purchase или exchange, у аукциона — null.`,
    );
  }

  if (!gameIds.has(entry.gameId)) {
    throw new Error(
      `Неизвестная игра «${entry.gameId}» в src/data/market.json. Добавьте её в games.json.`,
    );
  }

  if (entry.editionId !== null) {
    const edition = editionById.get(entry.editionId);

    if (!edition || edition.gameId !== entry.gameId) {
      throw new Error(
        `Проверьте editionId в записи «${entry.id}» в src/data/market.json: издание должно существовать и принадлежать игре «${entry.gameId}».`,
      );
    }
  }

  const editionRequired =
    entry.kind === 'auction' ||
    (entry.kind === 'listing' && entry.listingType !== 'purchase');

  if ((entry.itemType ?? 'game') === 'game' && editionRequired && entry.editionId === null) {
    throw new Error(
      `У записи «${entry.id}» в src/data/market.json должно быть указано издание (editionId).`,
    );
  }

  if (
    !entry.title.trim() ||
    !entry.condition.trim() ||
    !entry.seller.trim() ||
    !entry.description.trim()
  ) {
    throw new Error(`Заполните текстовые поля записи «${entry.id}» в src/data/market.json.`);
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
    itemType: marketItemTypeSchema.parse(entry.itemType ?? 'game'),
    kind: entry.kind,
    listingType: isMarketListingType(entry.listingType) ? entry.listingType : null,
    editionId: entry.editionId,
    status: 'active',
    deliveryServices: entry.deliveryServices.filter(isDeliveryService),
  };
});
