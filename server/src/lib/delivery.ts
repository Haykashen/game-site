import type { DeliveryService } from '@prisma/client';
import type { MarketDeliveryService } from '@retrokeep/shared';

const TO_API: Record<DeliveryService, MarketDeliveryService> = {
  russian_post: 'russian-post',
  cdek: 'cdek',
  yandex: 'yandex',
  other: 'other',
};

const FROM_API: Record<MarketDeliveryService, DeliveryService> = {
  'russian-post': 'russian_post',
  cdek: 'cdek',
  yandex: 'yandex',
  other: 'other',
};

export function deliveryServiceToApi(service: DeliveryService): MarketDeliveryService {
  return TO_API[service];
}

export function deliveryServiceFromApi(service: MarketDeliveryService): DeliveryService {
  return FROM_API[service];
}

export function serializeDeliveryServices(
  services: readonly DeliveryService[],
): MarketDeliveryService[] {
  return services.map(deliveryServiceToApi);
}

export function deliveryServicesFromApi(
  services: readonly MarketDeliveryService[],
): DeliveryService[] {
  return [...new Set(services.map(deliveryServiceFromApi))];
}
