import { z } from 'zod';
import type { PublicUser } from './auth.js';
import {
  idSchema,
  isoDateTimeSchema,
  nonNegativeRubleAmountSchema,
  paginationSchema,
  photoReferenceSchema,
  rubleAmountSchema,
} from './common.js';

export const marketKindSchema = z.enum(['listing', 'auction']);
export const marketListingTypeSchema = z.enum(['sale', 'purchase', 'exchange']);
export const marketStatusSchema = z.enum(['active', 'sold', 'closed']);
export const marketDeliveryServiceSchema = z.enum([
  'russian-post',
  'cdek',
  'yandex',
  'other',
]);

export type MarketKind = z.infer<typeof marketKindSchema>;
export type MarketListingType = z.infer<typeof marketListingTypeSchema>;
export type MarketStatus = z.infer<typeof marketStatusSchema>;
export type MarketDeliveryService = z.infer<typeof marketDeliveryServiceSchema>;

const marketFieldsSchema = z.object({
  kind: marketKindSchema,
  listingType: marketListingTypeSchema.nullable().optional(),
  gameId: idSchema,
  editionId: idSchema.nullable().optional(),
  title: z.string().trim().min(1, 'Укажите заголовок.').max(120),
  condition: z.string().trim().min(1, 'Укажите состояние.').max(60),
  price: rubleAmountSchema,
  description: z.string().trim().min(1, 'Добавьте описание.').max(600),
  photos: z.array(photoReferenceSchema).max(6).default([]),
  deliveryServices: z
    .array(marketDeliveryServiceSchema)
    .min(1, 'Выберите хотя бы одну службу доставки.')
    .max(4),
  internationalShipping: z.boolean().nullable().optional(),
  packagingPrice: nonNegativeRubleAmountSchema.nullable().optional(),
  shipsFrom: z.string().trim().min(1, 'Укажите город отправки.').max(80),
  bidStep: rubleAmountSchema.nullable().optional(),
  startsAt: isoDateTimeSchema.nullable().optional(),
  endsAt: isoDateTimeSchema.nullable().optional(),
});

export const marketCreateSchema = marketFieldsSchema.superRefine((value, ctx) => {
  if (value.kind === 'auction') {
    if (value.listingType !== null && value.listingType !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['listingType'],
        message: 'У аукциона не может быть типа объявления.',
      });
    }
    if (!value.bidStep) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bidStep'],
        message: 'Укажите шаг цены аукциона.',
      });
    }
    if (!value.endsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'Укажите дату закрытия аукциона.',
      });
    }
    if (value.startsAt && value.endsAt && Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'Дата закрытия должна быть позже даты открытия.',
      });
    }
  } else {
    if (value.listingType !== 'sale' && value.listingType !== 'purchase' && value.listingType !== 'exchange') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['listingType'],
        message: 'Выберите тип объявления: продажа, покупка или обмен.',
      });
    }
    if (value.endsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'У объявления не может быть даты закрытия торгов.',
      });
    }
    if (value.bidStep) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bidStep'],
        message: 'У объявления не может быть шага ставки.',
      });
    }
  }

  if (value.kind === 'auction' && !value.editionId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['editionId'],
      message: 'Для аукциона нужно указать издание.',
    });
  }

  if (value.kind === 'listing' && value.listingType !== 'purchase' && !value.editionId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['editionId'],
      message: 'Для продажи и обмена нужно указать издание.',
    });
  }
});

export const marketUpdateSchema = marketFieldsSchema.partial().extend({
  kind: marketKindSchema.optional(),
});

export const marketSearchSchema = paginationSchema.extend({
  kind: marketKindSchema.optional(),
  listingType: marketListingTypeSchema.optional(),
  status: z.enum(['active', 'sold', 'closed', 'all']).default('active'),
  gameId: idSchema.optional(),
  editionId: idSchema.optional(),
  authorId: z.union([z.literal('me'), idSchema]).optional(),
  q: z.string().trim().max(120).optional(),
  platform: z.string().trim().max(100).optional(),
  lang: z.string().trim().max(100).optional(),
  region: z.string().trim().max(100).optional(),
  edition: z.string().trim().max(100).optional(),
  completeness: z.string().trim().max(100).optional(),
  year: z.string().trim().max(20).optional(),
  sort: z.enum(['newest', 'oldest', 'endingSoon', 'priceAsc', 'priceDesc']).default('newest'),
});

export const marketStatusUpdateSchema = z.object({
  status: marketStatusSchema,
});

export const bidCreateSchema = z.object({
  amount: rubleAmountSchema,
});

export interface MarketEntryDto {
  id: string;
  kind: MarketKind;
  listingType: MarketListingType | null;
  gameId: string;
  editionId: string | null;
  title: string;
  condition: string;
  /** Asking price or starting auction price in rubles. */
  price: number;
  /** Current highest bid in rubles; equals `price` while there are no bids. */
  currentPrice: number;
  seller: string;
  authorId: string;
  author: PublicUser;
  description: string;
  status: MarketStatus;
  photos: string[];
  deliveryServices: MarketDeliveryService[];
  internationalShipping: boolean | null;
  packagingPrice: number | null;
  shipsFrom: string;
  /** Bid counter. `bids` is kept as an alias for the original frontend model. */
  bids: number;
  bidCount: number;
  bidStep: number | null;
  startsAt: string | null;
  endsAt: string | null;
  winnerId: string | null;
  version: number;
  soldAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BidDto {
  id: string;
  marketEntryId: string;
  bidder: PublicUser;
  amount: number;
  createdAt: string;
}

export interface PlaceBidResponse {
  bid: BidDto;
  entry: MarketEntryDto;
}

export type MarketCreateInput = z.infer<typeof marketCreateSchema>;
export type MarketUpdateInput = z.infer<typeof marketUpdateSchema>;
export type MarketSearchQuery = z.infer<typeof marketSearchSchema>;
export type MarketStatusUpdate = z.infer<typeof marketStatusUpdateSchema>;
export type BidCreateInput = z.infer<typeof bidCreateSchema>;
