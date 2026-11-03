import type { Edition, Game, MarketEntry } from '../../types';
import { AuctionCard } from './AuctionCard';
interface Props {entry:MarketEntry;game:Game|undefined;edition?:Edition|undefined;isOwn?:boolean;onSelect:(id:string)=>void}
/** One stable tile layout for auctions, sales, purchases and exchanges. */
export function MarketCard({entry,edition,isOwn=false,onSelect}:Props) {
  return <AuctionCard entry={entry} edition={entry.kind==='listing'?edition:undefined} isOwn={isOwn} onSelect={onSelect}/>;
}
