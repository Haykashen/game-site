import type { MarketListingType } from '../types';
import { MarketPage } from './MarketPage';

interface ListingsPageProps {
  /** When set, the page shows only this listing intention. */
  listingType?: MarketListingType | undefined;
}

export function ListingsPage({ listingType }: ListingsPageProps) {
  return <MarketPage kind="listing" listingType={listingType} />;
}
