import { Star } from 'lucide-react';
import { ProfileLink } from '../ProfileLink';
interface Props {name: string; userId?: string | undefined; rating: number | null | undefined}
/** Shared author name and rating for marketplace cards and community publications. */
export function AuthorRating({name, userId, rating}: Props) {
  return <span className="market-author">
    <ProfileLink name={name} userId={userId} />
    <span className="market-author__rating" aria-label={rating == null ? 'У автора пока нет оценок' : `Рейтинг автора ${rating} из 5`}>
      <Star size={14} aria-hidden="true" />
      {rating == null ? '—' : rating.toLocaleString('ru-RU', {maximumFractionDigits: 1})}
    </span>
  </span>;
}
