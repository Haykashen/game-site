import type {
  Bid,
  Copy,
  CopyPhoto,
  Discussion,
  DiscussionComment,
  Edition,
  Game,
  MarketEntry,
  Prisma,
  PrismaClient,
  User,
} from '@prisma/client';
import {
  fromMinorUnits,
  type AdminMarketEntryDto,
  type BidDto,
  type CopyDto,
  type DealDto,
  type DealEntrySummary,
  type DiscussionCommentDto,
  type DiscussionDetailDto,
  type DiscussionSummaryDto,
  type EditionDto,
  type GameDto,
  type GameSubscriptionDto,
  type MarketEntryDto,
  type MarketEntrySubscriptionDto,
  type NewsPostDto,
  type NotificationDto,
  type PublicUser,
  type ReportDto,
  type ReviewDto,
  type UserProfile,
} from '@discvault/shared';
import { serializeDeliveryServices } from './delivery.js';
import { ratingFrom } from './rating.js';

export const userSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  isDemo: true,
  status: true,
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
    role: user.role,
  };
}

export function serializeGame(game: Game & {series?: {name: string} | null; genres?: {name: string}[]}): GameDto {
  return {
    id: game.id,
    title: game.title,
    publisher: game.publisher,
    developer: game.developer,
    series: game.series?.name ?? '',
    year: game.year,
    genres: game.genres?.map(genre => genre.name) ?? [],
    description: game.description,
    coverImage: game.coverImage,
  };
}

export function serializeEdition(edition: Edition & {region?: {code:string}; variants?: (Edition & {region?: {code:string}})[]}): EditionDto {
  return {
    id: edition.id,
    gameId: edition.gameId,
    name: edition.name,
    platform: edition.platform,
    region: edition.region?.code ?? 'EUR',
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
    variants: (edition.variants ?? []).map(variant=>{
      const {variants:_ignored,...record}=serializeEdition(variant);
      return record;
    }),
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
    itemType: entry.itemType,
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
    moderationStatus: entry.moderationStatus,
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

export const adminMarketEntryInclude = {
  ...marketEntryInclude,
  moderator: { select: userSelect },
} satisfies Prisma.MarketEntryInclude;

export type AdminMarketEntryWithRelations = Prisma.MarketEntryGetPayload<{
  include: typeof adminMarketEntryInclude;
}>;

export function serializeAdminMarketEntry(
  entry: AdminMarketEntryWithRelations,
): AdminMarketEntryDto {
  return {
    ...serializeMarketEntry(entry),
    moderationNote: entry.moderationNote,
    moderatedAt: entry.moderatedAt?.toISOString() ?? null,
    moderator: entry.moderator ? serializePublicUser(entry.moderator) : null,
  };
}

export const discussionListInclude = {
  author: { select: userSelect },
  _count: { select: { comments: true } },
} satisfies Prisma.DiscussionInclude;

export type DiscussionSummaryWithRelations = Prisma.DiscussionGetPayload<{
  include: typeof discussionListInclude;
}>;

export const discussionDetailInclude = {
  author: { select: userSelect },
  comments: {
    include: { author: { select: userSelect } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.DiscussionInclude;

export type DiscussionDetailWithRelations = Prisma.DiscussionGetPayload<{
  include: typeof discussionDetailInclude;
}>;

export type DiscussionCommentWithAuthor = DiscussionComment & {
  author: SelectedUser;
};

function discussionBase(
  discussion: Discussion,
  author: SelectedUser,
  commentCount: number,
): DiscussionSummaryDto {
  return {
    id: discussion.id,
    gameId: discussion.gameId,
    title: discussion.title,
    excerpt: discussion.excerpt,
    body: discussion.body,
    authorId: discussion.authorId,
    author: serializePublicUser(author),
    createdAt: discussion.createdAt.toISOString(),
    updatedAt: discussion.updatedAt.toISOString(),
    views: discussion.views,
    tags: [...discussion.tags],
    pinned: discussion.pinned,
    commentCount,
  };
}

export function serializeDiscussionSummary(
  discussion: DiscussionSummaryWithRelations,
): DiscussionSummaryDto {
  return discussionBase(
    discussion,
    discussion.author,
    discussion._count.comments,
  );
}

export function serializeDiscussionComment(
  comment: DiscussionCommentWithAuthor,
  replies: DiscussionCommentDto[] = [],
): DiscussionCommentDto {
  return {
    id: comment.id,
    discussionId: comment.discussionId,
    parentId: comment.parentId,
    author: serializePublicUser(comment.author),
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    replies,
  };
}

/** Rebuilds arbitrary-depth reply threads from the flat comment rows. */
export function buildDiscussionCommentTree(
  comments: readonly DiscussionCommentWithAuthor[],
): DiscussionCommentDto[] {
  const byId = new Map<string, DiscussionCommentDto>();
  const roots: DiscussionCommentDto[] = [];

  for (const comment of comments) {
    byId.set(comment.id, serializeDiscussionComment(comment));
  }

  for (const comment of comments) {
    const dto = byId.get(comment.id);

    if (!dto) continue;

    const parent = comment.parentId ? byId.get(comment.parentId) : undefined;

    if (parent) {
      parent.replies.push(dto);
    } else {
      roots.push(dto);
    }
  }

  return roots;
}

export function serializeDiscussionDetail(
  discussion: DiscussionDetailWithRelations,
): DiscussionDetailDto {
  return {
    ...discussionBase(discussion, discussion.author, discussion.comments.length),
    comments: buildDiscussionCommentTree(discussion.comments),
  };
}

export const newsPostInclude = {
  author: { select: userSelect },
} satisfies Prisma.NewsPostInclude;

export type NewsPostWithAuthor = Prisma.NewsPostGetPayload<{
  include: typeof newsPostInclude;
}>;

export function serializeNewsPost(post: NewsPostWithAuthor): NewsPostDto {
  return {
    id: post.id,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    category: post.category,
    authorId: post.authorId,
    author: serializePublicUser(post.author),
    publishedAt: post.publishedAt.toISOString(),
    gameId: post.gameId,
    tags: [...post.tags],
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
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

export const reportInclude = {
  reporter: { select: userSelect },
  targetUser: { select: userSelect },
  moderator: { select: userSelect },
  marketEntry: {
    include: {
      author: { select: userSelect },
    },
  },
} satisfies Prisma.ReportInclude;

export type ReportWithRelations = Prisma.ReportGetPayload<{
  include: typeof reportInclude;
}>;

export function serializeReport(report: ReportWithRelations): ReportDto {
  const entry = report.marketEntry;

  return {
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    comment: report.comment,
    status: report.status,
    action: report.action,
    reporter: serializePublicUser(report.reporter),
    targetUser: report.targetUser ? serializePublicUser(report.targetUser) : null,
    marketEntry: entry
      ? {
          id: entry.id,
          title: entry.title,
          kind: entry.kind,
          status: entry.status,
          moderationStatus: entry.moderationStatus,
          author: serializePublicUser(entry.author),
        }
      : null,
    moderator: report.moderator ? serializePublicUser(report.moderator) : null,
    moderatorNote: report.moderatorNote,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
  };
}

export const notificationInclude = {
  actor: { select: userSelect },
  marketEntry: { select: { id: true, title: true, kind: true } },
  game: { select: { id: true, title: true } },
} satisfies Prisma.NotificationInclude;

export type NotificationWithRelations = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

export function serializeNotification(
  notification: NotificationWithRelations,
): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    marketEntryId: notification.marketEntryId,
    marketEntryTitle: notification.marketEntry?.title ?? null,
    marketEntryKind: notification.marketEntry?.kind ?? null,
    gameId: notification.gameId,
    gameTitle: notification.game?.title ?? null,
    actor: notification.actor ? serializePublicUser(notification.actor) : null,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export const gameSubscriptionInclude = {
  game: { select: { id: true, title: true } },
} satisfies Prisma.GameSubscriptionInclude;

export type GameSubscriptionWithRelations = Prisma.GameSubscriptionGetPayload<{
  include: typeof gameSubscriptionInclude;
}>;

export function serializeGameSubscription(
  subscription: GameSubscriptionWithRelations,
): GameSubscriptionDto {
  return {
    id: subscription.id,
    gameId: subscription.gameId,
    gameTitle: subscription.game.title,
    notifyAuctions: subscription.notifyAuctions,
    notifyListings: subscription.notifyListings,
    createdAt: subscription.createdAt.toISOString(),
  };
}

export const marketEntrySubscriptionInclude = {
  marketEntry: {
    select: { id: true, title: true, kind: true, gameId: true },
  },
} satisfies Prisma.MarketEntrySubscriptionInclude;

export type MarketEntrySubscriptionWithRelations =
  Prisma.MarketEntrySubscriptionGetPayload<{
    include: typeof marketEntrySubscriptionInclude;
  }>;

export function serializeMarketEntrySubscription(
  subscription: MarketEntrySubscriptionWithRelations,
): MarketEntrySubscriptionDto {
  return {
    id: subscription.id,
    marketEntryId: subscription.marketEntryId,
    entryTitle: subscription.marketEntry.title,
    entryKind: subscription.marketEntry.kind,
    gameId: subscription.marketEntry.gameId,
    createdAt: subscription.createdAt.toISOString(),
  };
}
