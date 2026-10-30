import {resolveRegion} from '../src/lib/regions.js';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import editionsJson from '../../src/data/editions.json';
import gamesJson from '../../src/data/games.json';
import marketJson from '../../src/data/market.json';
import { DISCUSSIONS } from '../../src/data/discussions.js';
import { NEWS_POSTS } from '../../src/data/news.js';
import { hashPassword } from '../src/auth/password.js';
import { env } from '../src/env.js';
import { deliveryServiceFromApi } from '../src/lib/delivery.js';
import type {
  SeedEdition,
  SeedGame,
  SeedMarketEntry,
} from '../src/lib/catalogData.js';
import { GAME_GENRES } from './reference-data.js';

const prisma = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1000;

const BIDDER_NAMES = [
  'collector_one',
  'retro_fox',
  'pixel_hunter',
  'cartridge_kid',
  'night_shopper',
] as const;

function toMinor(rubles: number): number {
  return Math.round(rubles * 100);
}

function releaseDate(value: string): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function demoEmail(slug: string): string {
  return `${slug}@demo.discvault.local`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'collector';
}

async function seedCatalog(): Promise<void> {
  const games = gamesJson as unknown as SeedGame[];
  const editions = editionsJson as unknown as SeedEdition[];

  for (const game of games) {
    const data = {
      title: game.title,
      publisher: game.publisher,
      developer: game.developer,
      ...(game.series.trim() ? {series: {connectOrCreate: {where: {name: game.series.trim()}, create: {name: game.series.trim()}}}} : {}),
      year: game.year,
      genres: {connectOrCreate: [...new Set(game.genres.flatMap(name => name.toLowerCase() === 'action rpg' ? ['Action','RPG'] : [name]))].map(name => ({where: {name}, create: {name}}))},
      description: game.description,
      coverImage: game.coverImage,
    };

    await prisma.game.upsert({
      where: { id: game.id },
      update: data,
      create: { id: game.id, ...data },
    });
  }

  for (const edition of editions) {
    const data = {
      gameId: edition.gameId,
      name: edition.name,
      platform: edition.platform,
      regionId: (await resolveRegion(prisma, edition.region)).id,
      lang: edition.lang,
      media: edition.media,
      releaseDate: releaseDate(edition.releaseDate),
      description: edition.description,
      contents: edition.contents,
      coverImages: edition.coverImages,
      barcode: edition.barcode,
      dnsProductId: edition.dnsProductId,
      dnsProductCode: edition.dnsProductCode,
    };

    await prisma.edition.upsert({
      where: { id: edition.id },
      update: data,
      create: { id: edition.id, ...data },
    });
  }

  console.log(`Seeded ${games.length} games and ${editions.length} editions.`);
}

async function seedReferenceTables(): Promise<void> {
  const games = await prisma.game.findMany({
    select: { series: {select: {name: true}} },
  });
  const genres = [...new Set(GAME_GENRES.flatMap(name => name.toLowerCase() === 'action rpg' ? ['Action','RPG'] : [name]))];
  const series = [...new Set(
    games
      .map((game) => (game.series?.name ?? '').trim())
      .filter(Boolean),
  )];

  for (const name of genres) {
    await prisma.gameGenre.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const name of series) {
    await prisma.gameSeries.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log(
    `Seeded ${genres.length} game genres and ${series.length} game series.`,
  );
}

async function seedUsers(): Promise<Map<string, string>> {
  const entries = marketJson as unknown as SeedMarketEntry[];
  const sellerNames = [...new Set(entries.map((entry) => entry.seller))];
  const communityNames = [
    ...DISCUSSIONS.map((discussion) => discussion.author),
    ...DISCUSSIONS.flatMap((discussion) =>
      discussion.comments.map((comment) => comment.author),
    ),
    ...NEWS_POSTS.map((post) => post.author),
  ];
  const userIdByName = new Map<string, string>();

  for (const name of [
    ...new Set([...sellerNames, ...BIDDER_NAMES, ...communityNames]),
  ]) {
    const email = demoEmail(slugify(name));
    const isBidder = (BIDDER_NAMES as readonly string[]).includes(name);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        displayName: name,
        isDemo: true,
        role: 'user',
        status: 'active',
        ratingSum: 0,
        ratingCount: 0,
        passwordHash: null,
        ...(isBidder ? { city: 'Москва' } : {}),
      },
      create: {
        email,
        displayName: name,
        isDemo: true,
        role: 'user',
        status: 'active',
        ratingSum: 0,
        ratingCount: 0,
        passwordHash: null,
        city: isBidder ? 'Москва' : null,
      },
    });

    userIdByName.set(name, user.id);
  }

  const demoEmailAddress = env.seedDemoEmail.trim().toLowerCase();
  const passwordHash = await hashPassword(env.seedDemoPassword);

  await prisma.user.upsert({
    where: { email: demoEmailAddress },
    update: {
      displayName: 'Demo Collector',
      isDemo: false,
      role: env.seedDemoRole,
      status: 'active',
      suspendedAt: null,
      comment: null,
      ratingSum: 0,
      ratingCount: 0,
      passwordHash,
      city: 'Москва',
    },
    create: {
      email: demoEmailAddress,
      displayName: 'Demo Collector',
      isDemo: false,
      role: env.seedDemoRole,
      status: 'active',
      ratingSum: 0,
      ratingCount: 0,
      passwordHash,
      city: 'Москва',
    },
  });

  console.log(
    `Seeded ${sellerNames.length} demo sellers, ${BIDDER_NAMES.length} bidders and the demo login ${demoEmailAddress} (${env.seedDemoRole}).`,
  );

  return userIdByName;
}

async function seedMarket(userIdByName: Map<string, string>): Promise<void> {
  const entries = marketJson as unknown as SeedMarketEntry[];
  const bidderIds = BIDDER_NAMES.map((name) => userIdByName.get(name)).filter(
    (id): id is string => Boolean(id),
  );

  // Rebuild seeded lots from scratch. Cascades remove their bids, photos,
  // deals and reviews, so re-running the seed cannot resurrect sold lots or
  // attach fresh bids to an old deal.
  await prisma.marketEntry.deleteMany({ where: { isSeeded: true } });

  for (const [index, entry] of entries.entries()) {
    const authorId = userIdByName.get(entry.seller);

    if (!authorId) {
      throw new Error(`No demo user for market author "${entry.seller}".`);
    }

    const isAuction = entry.kind === 'auction';
    const bidStepMinor = entry.bidStep === null ? null : toMinor(entry.bidStep);
    const calculatedCurrentPriceMinor =
      isAuction && entry.bids > 0
        ? toMinor(entry.price) + (bidStepMinor ?? 0) * entry.bids
        : toMinor(entry.price);

    // The JSON demo lots have fixed dates. Shift them relative to the seed run
    // so a fresh database always has one to four days left to bid.
    const now = Date.now();
    const originalStart = entry.startsAt ? Date.parse(entry.startsAt) : now;
    const originalEnd = entry.endsAt ? Date.parse(entry.endsAt) : now + 5 * DAY_MS;
    const duration = Math.max(originalEnd - originalStart, DAY_MS);
    const shiftedEnd = now + (1 + (index % 4)) * DAY_MS;
    const shiftedStart = shiftedEnd - duration;
    const startsAt = isAuction ? new Date(shiftedStart) : null;
    const endsAt = isAuction ? new Date(shiftedEnd) : null;

    const data = {
      authorId,
      kind: entry.kind,
      itemType: entry.itemType ?? 'game',
      listingType: isAuction ? null : entry.listingType,
      gameId: entry.gameId,
      editionId: entry.editionId,
      title: entry.title,
      condition: entry.condition,
      priceMinor: toMinor(entry.price),
      description: entry.description,
      status: 'active' as const,
      moderationStatus: 'visible' as const,
      deliveryServices: entry.deliveryServices.map(deliveryServiceFromApi),
      internationalShipping: entry.internationalShipping,
      packagingPriceMinor:
        entry.packagingPrice === null ? null : toMinor(entry.packagingPrice),
      shipsFrom: entry.shipsFrom,
      bidStepMinor: isAuction ? bidStepMinor : null,
      startsAt,
      endsAt,
      currentPriceMinor: isAuction ? calculatedCurrentPriceMinor : null,
      bidCount: isAuction ? entry.bids : 0,
      isSeeded: true,
      createdAt: new Date(entry.createdAt),
      deletedAt: null,
      soldAt: null,
      winnerId: null,
      version: 0,
    };

    await prisma.marketEntry.upsert({
      where: { id: entry.id },
      update: data,
      create: { id: entry.id, ...data },
    });

    await prisma.bid.deleteMany({ where: { marketEntryId: entry.id } });

    if (!isAuction || entry.bids === 0 || bidderIds.length === 0) continue;

    const bidWindowStart = startsAt?.getTime() ?? Date.now();
    const bidWindowEnd = endsAt?.getTime() ?? Date.now();
    const span = Math.max(bidWindowEnd - bidWindowStart, 1);
    const stepMinor = bidStepMinor ?? toMinor(100);
    const startMinor = toMinor(entry.price);

    await prisma.bid.createMany({
      data: Array.from({ length: entry.bids }, (_, index) => {
        const bidderId = bidderIds[index % bidderIds.length];
        const createdAt = new Date(
          Math.min(
            bidWindowStart + Math.round((span * (index + 1)) / (entry.bids + 1)),
            bidWindowEnd - 1000,
          ),
        );

        return {
          marketEntryId: entry.id,
          bidderId: bidderId as string,
          amountMinor: startMinor + stepMinor * (index + 1),
          createdAt,
        };
      }),
    });
  }

  console.log(`Seeded ${entries.length} market entries and their demo bids.`);
}

async function seedCommunity(userIdByName: Map<string, string>): Promise<void> {
  // Seeded threads are rebuilt from the demo data so re-running the seed
  // restores their initial replies and removes local test comments.
  await prisma.discussion.deleteMany({ where: { isSeeded: true } });
  await prisma.newsPost.deleteMany({ where: { isSeeded: true } });

  let commentCount = 0;

  for (const discussion of DISCUSSIONS) {
    const authorId = userIdByName.get(discussion.author);

    if (!authorId) {
      throw new Error(`No demo user for discussion author "${discussion.author}".`);
    }

    await prisma.discussion.create({
      data: {
        id: discussion.id,
        gameId: discussion.gameId,
        authorId,
        title: discussion.title,
        excerpt: discussion.excerpt,
        body: discussion.body,
        tags: discussion.tags,
        pinned: discussion.pinned,
        views: discussion.views,
        isSeeded: true,
        createdAt: new Date(discussion.createdAt),
        updatedAt: new Date(discussion.updatedAt),
      },
    });

    for (const comment of discussion.comments) {
      const commentAuthorId = userIdByName.get(comment.author);

      if (!commentAuthorId) {
        throw new Error(`No demo user for discussion comment author "${comment.author}".`);
      }

      await prisma.discussionComment.create({
        data: {
          id: comment.id,
          discussionId: discussion.id,
          authorId: commentAuthorId,
          parentId: comment.parentId ?? null,
          body: comment.body,
          createdAt: new Date(comment.createdAt),
          updatedAt: new Date(comment.updatedAt ?? comment.createdAt),
        },
      });
      commentCount += 1;
    }
  }

  for (const post of NEWS_POSTS) {
    const authorId = userIdByName.get(post.author);

    if (!authorId) {
      throw new Error(`No demo user for news author "${post.author}".`);
    }

    await prisma.newsPost.create({
      data: {
        id: post.id,
        authorId,
        gameId: post.gameId,
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        category: post.category,
        tags: post.tags,
        isSeeded: true,
        publishedAt: new Date(post.publishedAt),
      },
    });
  }

  console.log(
    `Seeded ${DISCUSSIONS.length} discussions with ${commentCount} replies and ${NEWS_POSTS.length} news posts.`,
  );
}

async function main(): Promise<void> {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_DEMO_SEED !== 'true'
  ) {
    throw new Error(
      'Demo seed is disabled in production. Set ALLOW_DEMO_SEED=true only for a deliberate demo environment.',
    );
  }

  await seedCatalog();
  await seedReferenceTables();
  const userIdByName = await seedUsers();
  await seedMarket(userIdByName);
  await seedCommunity(userIdByName);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
