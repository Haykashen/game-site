import type { MarketEntry } from '../../types';
import { AuthorRating } from '../ui/AuthorRating';
export function MarketAuthor({entry}: {entry: MarketEntry}) {
  return <AuthorRating name={entry.seller} userId={entry.authorId} rating={entry.sellerRating} />;
}
