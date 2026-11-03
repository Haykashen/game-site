import { Images, Star, Tag, ShoppingBag, ArrowLeftRight, Gavel } from 'lucide-react';
import { marketItemLabel } from '@discvault/shared';
import type { MarketEntry, Edition } from '../../types';
import { FallbackImage } from '../FallbackImage';
import { ProfileLink } from '../ProfileLink';
import { formatPrice } from '../../lib/formatPrice';
import { bidsLabel } from '../../lib/market';

const endDate = new Intl.DateTimeFormat('ru-RU', {day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Moscow'});
const endTime = new Intl.DateTimeFormat('ru-RU', {hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'});

/** Depends only on the lot payload: catalogue loading cannot change its layout. */
export function AuctionCard({entry,edition,onSelect}: {entry:MarketEntry;edition?:Edition|undefined;isOwn:boolean;onSelect:(id:string)=>void}) {
  const auction=entry.kind==='auction';
  const exchange=entry.listingType==='exchange';
  const purchase=entry.listingType==='purchase';
  const KindIcon=exchange?ArrowLeftRight:purchase?ShoppingBag:Tag;
  const kindLabel=exchange?'Обмен':purchase?'Покупка':'Продажа';
  const exchangeText=entry.description.replace(/^\s*(ищу(?:\s+взамен)?|обменяю\s+на)\s*:?\s*/i,'').trim();
  const status = entry.moderationStatus === 'draft' ? 'Черновик' : entry.status === 'sold' ? 'Продано' : entry.status === 'closed' ? 'Закрыто' : entry.moderationStatus === 'pending' ? 'На проверке' : entry.moderationStatus === 'hidden' ? 'Отклонено' : entry.moderationStatus === 'removed' ? 'Удалено' : 'Активно';
  const end = entry.endsAt ? new Date(entry.endsAt) : null;
  const validEnd = end && Number.isFinite(end.getTime()) ? end : null;
  const rating = entry.sellerRating;
  return <article className={`auction-tile${auction?'':` listing-tile listing-tile--${entry.listingType??'sale'}`}`} role="button" tabIndex={0} aria-label={`Открыть ${auction?'лот':'объявление'}: ${entry.title}`} onClick={()=>onSelect(entry.id)} onKeyDown={event=>{if(event.target===event.currentTarget && (event.key==='Enter'||event.key===' ')){event.preventDefault();onSelect(entry.id);}}}>
    <div className="auction-tile__photo">
      <div className="auction-tile__placeholder"><Images size={28} aria-hidden="true"/><span>{entry.photos.length ? 'Фотография недоступна' : 'Фотографии не добавлены'}</span></div>
      {entry.photos.length>0 && <FallbackImage images={entry.photos} alt="Фотография предмета от продавца" loading="lazy" decoding="async"/>}
    </div>
    <div className="auction-tile__content">
      <div className="auction-tile__header">
        {auction?<span className="listing-tile__kind auction-tile__kind"><Gavel size={16} aria-hidden="true"/>Аукцион</span>:<span className="listing-tile__kind"><KindIcon size={16} aria-hidden="true"/>{kindLabel}</span>}
        <div className="auction-tile__seller"><ProfileLink name={entry.seller} userId={entry.authorId}/><span className="auction-tile__rating" aria-label={rating==null?'У автора пока нет оценок':`Рейтинг автора ${rating} из 5`}><Star size={14} aria-hidden="true"/>{rating==null?'—':rating.toLocaleString('ru-RU',{maximumFractionDigits:1})}</span></div>
      </div>
      <div className="auction-tile__main"><div className="auction-tile__subject">Предмет: <span>{marketItemLabel(entry.itemType)}</span></div><h2 title={entry.title}>{entry.title}</h2>{auction?<span className="auction-tile__status auction-tile__status--below">{status}</span>:<div className="listing-tile__spec">{[edition?.platform,edition?.region,entry.condition].filter(Boolean).join(' · ')}</div>}</div>
      <div className="auction-tile__bottom">
        <div><div className="auction-tile__label">{auction?(entry.bids>0?'Текущая ставка':'Стартовая ставка'):exchange?(/^\s*(ищу|обменяю\s+на)/i.test(entry.description)?'Ищу взамен':'Условия обмена'):purchase?'Бюджет':'Цена'}</div><div className={exchange?'listing-tile__exchange':'auction-tile__price'}>{exchange?(exchangeText||'Обсуждаются с автором'):`${purchase?'до ':''}${formatPrice(entry.currentPrice??entry.price)}`}</div>{auction&&<div className="auction-tile__bids">{bidsLabel(entry.bids)}</div>}{!auction&&status!=='Активно'&&<span className="listing-tile__state">{status}</span>}</div>
        {auction&&<div className="auction-tile__ending"><div className="auction-tile__label">Окончание · МСК</div><time dateTime={entry.endsAt??undefined}>{validEnd?<>{endDate.format(validEnd)}<br/>{endTime.format(validEnd)}</>:'Не указано'}</time></div>}
      </div>
    </div>
  </article>;
}
