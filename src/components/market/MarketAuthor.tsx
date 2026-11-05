import { Star } from 'lucide-react';
import type { MarketEntry } from '../../types';
import { ProfileLink } from '../ProfileLink';

export function MarketAuthor({ entry }: { entry: MarketEntry }) {
  const rating = entry.sellerRating;
  return <span className="market-author">
    <ProfileLink name={entry.seller} userId={entry.authorId} />
    <span className="market-author__rating" aria-label={rating == null ? 'У автора пока нет оценок' : `Рейтинг автора ${rating} из 5`}>
      <Star size={14} aria-hidden="true" />
      {rating == null ? '—' : rating.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}
    </span>
  </span>;
}