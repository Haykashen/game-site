import { z } from 'zod';

export const marketItemTypeSchema = z.enum(['game', 'cover', 'manual', 'map', 'soundtrack', 'figure', 'steelbook', 'other']);
export type MarketItemType = z.infer<typeof marketItemTypeSchema>;
export const MARKET_ITEM_OPTIONS = [
  { value: 'game', label: 'Игра / издание' },
  { value: 'cover', label: 'Обложка' },
  { value: 'manual', label: 'Мануал' },
  { value: 'map', label: 'Карта' },
  { value: 'soundtrack', label: 'Саундтрек' },
  { value: 'figure', label: 'Фигурка' },
  { value: 'steelbook', label: 'Стилбук' },
  { value: 'other', label: 'Другой лут' },
] as const satisfies readonly { value: MarketItemType; label: string }[];

export function marketItemLabel(type: MarketItemType): string {
  return MARKET_ITEM_OPTIONS.find((option) => option.value === type)?.label ?? 'Игра / издание';
}
