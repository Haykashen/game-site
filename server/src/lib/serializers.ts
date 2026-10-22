import type {
  Bid,
  Copy,
  CopyPhoto,
  Edition,
  Game,
  MarketEntry,
  Prisma,
  PrismaClient,
  User,
} from '@prisma/client';
import {
  fromMinorUnits,
  type BidDto,
  type CopyDto,
  type DealDto,
  type DealEntrySummary,
  type EditionDto,
  type GameDto,
  type MarketEntryDto,
  type PublicUser,
  type ReviewDto,
  type UserProfile,
} from '@retrokeep/shared';
import { serializeDeliveryServices } from './delivery.js';
import { ratingFrom } from './rating.js';

export const userSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  isDemo: true,
  ratingSum: true,
  ratingCount: true,
} satisfies Prisma.UserSelect;

export type SelectedUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export function serializePublicUser(user: SelectedUser): PublicUser {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isDemo: user.isDemo,
    rating: ratingFrom(user.ratingSum, user.ratingCount),
    reviewCount: user.ratingCount,
  };
}

export async function getUserProfile(
  client: PrismaClient,
  user: User,
): Promise<UserProfile> {
  const dealsCompleted = await client.deal.count({
    where: {
      status: 'completed',
      OR: [{ buyerId: user.id }, { sellerId: user.id }],
    },
  });

  return {
    ...serializePublicUser(user),
    email: user.email,
    phone: user.phone,
    city: user.city,
    dealsCompleted,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeGame(game: Game): GameDto {
  return {
    id: game.id,
    title: game.title,
    publisher: game.publisher,
    developer: game.developer,
    series: game.series,
    year: game.year,
    genres: game.genres,
    description: game.description,
    coverImage: game.coverImage,
  };
}

export function serializeEdition(edition: Edition): EditionDto {
  return {
    id: edition.id,
    gameId: edition.gameId,
    name: edition.name,
    platform: edition.platform,
    region: edition.region,
    lang: edition.lang,
    media: edition.media,
    releaseDate: edition.releaseDate
      ? edition.releaseDate.toISOString().slice(0, 10)
      : '',
    description: edition.description,
    contents: edition.contents,
    coverImages: edition.coverImages,
    barcode: edition.barcode,
    dnsProductId: edition.dnsProductId,
    dnsProductCode: edition.dnsProductCode,
  };
}

type CopyWithPhotos = Copy & { photos: CopyPhoto[] };

export function serializeCopy(copy: CopyWithPhotos): CopyDto {
  return {
    id: copy.id,
    editionId: copy.editionId,
    condition: copy.condition,
    completeness: copy.completeness,
    purchasePrice:
      copy.purchasePriceMinor === null ? null : fromMinorUnits(copy.purchasePriceMinor),
    purchaseDate: copy.purchaseDate
      ? copy.purchaseDate.toISOString().slice(0, 10)
      : '',
    notes: copy.notes,
    photos: [...copy.photos]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((photo) => photo.url),
    createdAt: copy.createdAt.toISOString(),
    updatedAt: copy.updatedAt.toISOString(),
  };
}

export const marketEntryInclude = {
  author: { select: userSelect },
  photos: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.MarketEntryInclude;

export type MarketEntryWithRelations = Prisma.MarketEntryGetPayload<{
  include: typeof marketEntryInclude;
}>;

export function serializeMarketEntry(entry: MarketEntryWithRelations): MarketEntryDto {
  return {
    id: entry.id,
    kind: entry.kind,
    listingType: entry.listingType,
    gameId: entry.gameId,
    editionId: entry.editionId,
    title: entry.title,
    condition: entry.condition,
    price: fromMinorUnits(entry.priceMinor),
    currentPrice: fromMinorUnits(entry.currentPriceMinor ?? entry.priceMinor),
    seller: entry.author.displayName,
    authorId: entry.authorId,
    author: serializePublicUser(entry.author),
    description: entry.description,
    status: entry.status,
    photos: entry.photos.map((photo) => photo.url),
    deliveryServices: serializeDeliveryServices(entry.deliveryServices),
    internationalShipping: entry.internationalShipping,
    packagingPrice:
      entry.packagingPriceMinor === null
        ? null
        : fromMinorUnits(entry.packagingPriceMinor),
    shipsFrom: entry.shipsFrom,
    bids: entry.bidCount,
    bidCount: entry.bidCount,
    bidStep: entry.bidStepMinor === null ? null : fromMinorUnits(entry.bidStepMinor),
    startsAt: entry.startsAt?.toISOString() ?? null,
    endsAt: entry.endsAt?.toISOString() ?? null,
    winnerId: entry.winnerId,
    version: entry.version,
    soldAt: entry.soldAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export const bidInclude = {
  bidder: { select: userSelect },
} satisfies Prisma.BidInclude;

export type BidWithBidder = Bid & {
  bidder: SelectedUser;
};

export function serializeBid(bid: BidWithBidder): BidDto {
  return {
    id: bid.id,
    marketEntryId: bid.marketEntryId,
    bidder: serializePublicUser(bid.bidder),
    amount: fromMinorUnits(bid.amountMinor),
    createdAt: bid.createdAt.toISOString(),
  };
}

export const reviewInclude = {
  author: { select: userSelect },
  target: { select: userSelect },
} satisfies Prisma.ReviewInclude;

export type ReviewWithRelations = Prisma.ReviewGetPayload<{
  include: typeof reviewInclude;
}>;

export function serializeReview(review: ReviewWithRelations): ReviewDto {
  return {
    id: review.id,
    dealId: review.dealId,
    author: serializePublicUser(review.author),
    target: serializePublicUser(review.target),
    rating: review.rating,
    text: review.text,
    createdAt: review.createdAt.toISOString(),
  };
}

export const dealInclude = {
  marketEntry: true,
  buyer: { select: userSelect },
  seller: { select: userSelect },
  reviews: {
    include: reviewInclude,
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.DealInclude;

export type DealWithRelations = Prisma.DealGetPayload<{
  include: typeof dealInclude;
}>;

function dealEntrySummary(entry: MarketEntry): DealEntrySummary {
  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    gameId: entry.gameId,
    editionId: entry.editionId,
    price: fromMinorUnits(entry.priceMinor),
    status: entry.status,
  };
}

export function serializeDeal(deal: DealWithRelations, currentUserId: string): DealDto {
  const isParticipant = deal.buyerId === currentUserId || deal.sellerId === currentUserId;
  const hasReviewed = deal.reviews.some((review) => review.authorId === currentUserId);

  return {
    id: deal.id,
    marketEntryId: deal.marketEntryId,
    entry: dealEntrySummary(deal.marketEntry),
    buyer: serializePublicUser(deal.buyer),
    seller: serializePublicUser(deal.seller),
    amount: fromMinorUnits(deal.amountMinor),
    status: deal.status,
    createdAt: deal.createdAt.toISOString(),
    completedAt: deal.completedAt?.toISOString() ?? null,
    reviews: deal.reviews.map(serializeReview),
    canReview: isParticipant && deal.status === 'completed' && !hasReviewed,
    canComplete: isParticipant && deal.status === 'pending',
  };
}
