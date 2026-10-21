import type { MarketDeliveryService } from '../types';

export interface DeliveryOption {
  value: MarketDeliveryService;
  label: string;
}

/** The fixed courier list shown in the placement form and the entry card. */
export const DELIVERY_SERVICES = [
  { value: 'russian-post', label: 'Почта России' },
  { value: 'cdek', label: 'СДЭК' },
  { value: 'yandex', label: 'Яндекс Доставка' },
  { value: 'other', label: 'Другое' },
] as const satisfies readonly DeliveryOption[];

const DELIVERY_LABELS: ReadonlyMap<MarketDeliveryService, string> = new Map(
  DELIVERY_SERVICES.map(({ value, label }) => [value, label] as const),
);

export function isDeliveryService(value: unknown): value is MarketDeliveryService {
  return (
    typeof value === 'string' &&
    DELIVERY_LABELS.has(value as MarketDeliveryService)
  );
}

export function deliveryLabel(value: MarketDeliveryService): string {
  return DELIVERY_LABELS.get(value) ?? value;
}
