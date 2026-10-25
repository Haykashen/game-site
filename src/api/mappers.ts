import type {
  CopyDto,
  DiscussionCommentDto,
  DiscussionDetailDto,
  DiscussionSummaryDto,
  MarketEntryDto,
  NewsPostDto,
} from '@discvault/shared';
import type {
  Copy,
  Discussion,
  DiscussionComment,
  MarketEntry,
  NewsPost,
} from '../types';

/**
 * The API stores auction prices separately, while the original demo model kept
 * the current bid in `price`. Normalize to the shape used by the UI.
 */
export function mapMarketEntry(dto: MarketEntryDto): MarketEntry {
  return {
    id: dto.id,
    kind: dto.kind,
    listingType: dto.listingType,
    gameId: dto.gameId,
    editionId: dto.editionId,
    title: dto.title,
    condition: dto.condition,
    price: dto.kind === 'auction' ? dto.currentPrice : dto.price,
    seller: dto.seller,
    description: dto.description,
    status: dto.status,
    moderationStatus: dto.moderationStatus,
    photos: [...dto.photos],
    deliveryServices: [...dto.deliveryServices],
    internationalShipping: dto.internationalShipping,
    packagingPrice: dto.packagingPrice,
    shipsFrom: dto.shipsFrom,
    bids: dto.bidCount,
    bidStep: dto.bidStep,
    startsAt: dto.startsAt,
    endsAt: dto.endsAt,
    createdAt: dto.createdAt,
    authorId: dto.authorId,
    currentPrice: dto.currentPrice,
    ...(dto.kind === 'auction' ? { startPrice: dto.price } : {}),
    version: dto.version,
    winnerId: dto.winnerId,
  };
}

export function mapCopy(dto: CopyDto): Copy {
  return {
    id: dto.id,
    editionId: dto.editionId,
    condition: dto.condition,
    completeness: dto.completeness,
    purchasePrice: dto.purchasePrice,
    purchaseDate: dto.purchaseDate,
    notes: dto.notes,
    photos: [...dto.photos],
    createdAt: dto.createdAt,
  };
}

export function mapDiscussionComment(
  dto: DiscussionCommentDto,
): DiscussionComment {
  return {
    id: dto.id,
    authorId: dto.author.id,
    author: dto.author.displayName,
    body: dto.body,
    parentId: dto.parentId,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    replies: dto.replies.map(mapDiscussionComment),
  };
}

export function mapDiscussionSummary(dto: DiscussionSummaryDto): Discussion {
  return {
    id: dto.id,
    gameId: dto.gameId,
    title: dto.title,
    excerpt: dto.excerpt,
    body: dto.body,
    authorId: dto.authorId,
    author: dto.author.displayName,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    views: dto.views,
    tags: [...dto.tags],
    pinned: dto.pinned,
    commentCount: dto.commentCount,
    comments: [],
  };
}

export function mapDiscussionDetail(dto: DiscussionDetailDto): Discussion {
  return {
    ...mapDiscussionSummary(dto),
    comments: dto.comments.map(mapDiscussionComment),
  };
}

export function mapNewsPost(dto: NewsPostDto): NewsPost {
  return {
    id: dto.id,
    title: dto.title,
    excerpt: dto.excerpt,
    body: dto.body,
    category: dto.category,
    authorId: dto.authorId,
    author: dto.author.displayName,
    publishedAt: dto.publishedAt,
    gameId: dto.gameId,
    tags: [...dto.tags],
  };
}
