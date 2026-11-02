import { Images, Star } from 'lucide-react';
import { marketItemLabel } from '@discvault/shared';
import type { MarketEntry } from '../../types';
import { FallbackImage } from '../FallbackImage';
import { ProfileLink } from '../ProfileLink';
import { formatPrice } from '../../lib/formatPrice';
import { bidsLabel } from '../../lib/market';

const endDate = new Intl.DateTimeFormat('ru-RU', {day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Moscow'});
const endTime = new Intl.DateTimeFormat('ru-RU', {hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'});

/** Depends only on the lot payload: catalogue loading cannot change its layout. */
export function AuctionCard({entry,isOwn,onSelect}: {entry:MarketEntry;isOwn:boolean;onSelect:(id:string)=>void}) {
  const status = entry.moderationStatus === 'draft' ? 'Черновик' : entry.status === 'sold' ? 'Продано' : entry.status === 'closed' ? 'Закрыто' : entry.moderationStatus === 'pending' ? 'На проверке' : entry.moderationStatus === 'hidden' ? 'Отклонено' : entry.moderationStatus === 'removed' ? 'Удалено' : 'Активно';
  const end = entry.endsAt ? new Date(entry.endsAt) : null;
  const validEnd = end && Number.isFinite(end.getTime()) ? end : null;
  const rating = entry.sellerRating;
  return <article className="auction-tile" role="button" tabIndex={0} aria-label={`Открыть лот: ${entry.title}`} onClick={()=>onSelect(entry.id)} onKeyDown={event=>{if(event.target===event.currentTarget && (event.key==='Enter'||event.key===' ')){event.preventDefault();onSelect(entry.id);}}}>
    <div className="auction-tile__photo">
      <div className="auction-tile__placeholder"><Images size={28} aria-hidden="true"/><span>{entry.photos.length ? 'Фотография недоступна' : 'Фотографии не добавлены'}</span></div>
      {entry.photos.length>0 && <FallbackImage images={entry.photos} alt="Фотография предмета от продавца" loading="lazy" decoding="async"/>}
    </div>
    <div className="auction-tile__content">
      <div className="auction-tile__header">
        <span className="auction-tile__status">{status}</span>
        <div className="auction-tile__seller"><ProfileLink name={entry.seller} userId={entry.authorId}/><span className="auction-tile__rating" aria-label={rating==null?'У автора пока нет оценок':`Рейтинг автора ${rating} из 5`}><Star size={14} aria-hidden="true"/>{rating==null?'—':rating.toLocaleString('ru-RU',{maximumFractionDigits:1})}</span></div>
      </div>
      <div className="auction-tile__main"><div className="auction-tile__subject">Предмет: <span>{marketItemLabel(entry.itemType)}</span>{isOwn && <span className="auction-tile__own">Моё</span>}</div><h2 title={entry.title}>{entry.title}</h2></div>
      <div className="auction-tile__bottom">
        <div><div className="auction-tile__label">{entry.bids>0?'Текущая ставка':'Стартовая ставка'}</div><div className="auction-tile__price">{formatPrice(entry.currentPrice??entry.price)}</div><div className="auction-tile__bids">{bidsLabel(entry.bids)}</div></div>
        <div className="auction-tile__ending"><div className="auction-tile__label">Окончание · МСК</div><time dateTime={entry.endsAt??undefined}>{validEnd?<>{endDate.format(validEnd)}<br/>{endTime.format(validEnd)}</>:'Не указано'}</time></div>
      </div>
    </div>
  </article>;
}
