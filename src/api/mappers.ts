import type { CopyDto, MarketEntryDto } from '@retrokeep/shared';
import type { Copy, MarketEntry } from '../types';

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
