import { Library, Minus, Pencil, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCollection } from '../context/CollectionContext';
import { getPlatformBadgeStyle } from '../data/reference';
import { MAX_COLLECTION_QUANTITY } from '../lib/constants';
import { editionsCountLabel } from '../lib/market';
import type { Copy, CopyDetails, Edition, Game, MarketEntry } from '../types';
import { ArtworkPanel } from './modal/ArtworkPanel';
import { GameSubscriptionButton } from './GameSubscriptionButton';
import { GameRatings } from './GameRatings';
import { GameActions } from './modal/GameActions';
import { GameMarketSection } from './modal/GameMarketSection';
import type { GameMarketTab } from './modal/GameMarketSection';
import { CopyEditForm } from './collection/CopyEditForm';
import { IconButton } from './ui/IconButton';
import { ModalShell } from './ui/ModalShell';
import { ApiState } from './ApiState';
import { useAuth } from '../context/AuthContext';

interface GameModalProps {
  marketLoading: boolean;
  marketError: string | null;
  onRetryMarket: () => Promise<void>;
  onEditGame?: () => void;
  game: Game;
  isOpen: boolean;
  editions: readonly Edition[];
  copies: readonly Copy[];
  initialEditionId: string;
  entries: readonly MarketEntry[];
  onClose: () => void;
  onOpenMarketEntry: (entry: MarketEntry) => void;
  onOpenDiscussions: (gameId: string) => void;
  onAddCopy: (editionId: string, details?: CopyDetails) => Promise<boolean>;
  onSetEditionQuantity: (editionId: string, quantity: number) => void;
  onRemoveEdition: (editionId: string) => void;
  onPlaceListing: (editionId?: string) => void;
  onPlaceAuction: (editionId?: string) => void;
}

/** Game details and marketplace share one platform and edition selection. */
export function GameModal({ marketLoading, marketError, onRetryMarket, onEditGame, game, isOpen, editions, copies, initialEditionId, entries, onClose, onOpenMarketEntry, onOpenDiscussions, onAddCopy, onSetEditionQuantity, onRemoveEdition, onPlaceListing, onPlaceAuction }: GameModalProps) {
  const { syncError } = useCollection();
  const { isModerator } = useAuth();
  const [activeMarketTab, setActiveMarketTab] = useState<GameMarketTab>('lots');
  const [selectedEditionId, setSelectedEditionId] = useState(() => editions.find(edition => edition.id === initialEditionId || edition.variants?.some(variant => variant.id === initialEditionId))?.id ?? editions[0]?.id ?? '');
  const [copyFormOpen, setCopyFormOpen] = useState(false);
  const [savingCopy, setSavingCopy] = useState(false);
  const platforms = useMemo(() => [...new Set(editions.map(edition => edition.platform))], [editions]);
  const selectedEdition = editions.find(edition => edition.id === selectedEditionId) ?? editions[0];
  const selectedEditionCopies = selectedEdition ? copies.filter(copy => copy.editionId === selectedEdition.id || selectedEdition.variants?.some(variant => variant.id === copy.editionId)) : [];
  const closeCopyForm = () => { if (!savingCopy) setCopyFormOpen(false); };
  const blankCopy: Copy = { id: 'new-copy', editionId: selectedEdition?.id ?? '', condition: '', completeness: '', purchasePrice: null, purchaseDate: '', notes: '', photos: [], createdAt: '' };

  return <ModalShell isOpen={isOpen} onClose={copyFormOpen ? closeCopyForm : onClose} labelledBy={copyFormOpen ? 'add-copy-title' : 'modal-title'} focusKey={copyFormOpen ? 'copy-form' : 'game'}>
    {copyFormOpen && selectedEdition ? <>
      <CopyEditForm copy={blankCopy} edition={selectedEdition} game={game} quantity={1} titleId="add-copy-title" mode="create" isSaving={savingCopy} onCancel={closeCopyForm}
        onSubmit={async details => { if (savingCopy) return; setSavingCopy(true); try { if (await onAddCopy(selectedEdition.id, details)) setCopyFormOpen(false); } finally { setSavingCopy(false); } }} />
      {syncError && <p className="market-form__error" role="alert">{syncError}</p>}
    </> : <div className="game-detail">
      <div className="modal-header game-modal__header">
        <div><div className="modal-header-meta">
          {game.year !== null && <span className="year">{game.year}</span>}<span className="meta-chip">{editionsCountLabel(editions.length)}</span>{game.genres.slice(0, 2).map(genre => <span className="meta-chip" key={genre}>{genre}</span>)}
        </div><h2 className="modal-title" id="modal-title">{game.title}</h2></div>
        <div className="game-modal__admin-actions">
          {isModerator && onEditGame && <button type="button" className="btn-secondary" onClick={onEditGame}><Pencil size={15} aria-hidden="true" />Редактировать игру</button>}
          <GameSubscriptionButton gameId={game.id} />
          <IconButton label="Закрыть" transparent onClick={onClose}><X size={20} /></IconButton>
        </div>
      </div>
      <div className="game-detail__overview">
        <ArtworkPanel key={selectedEdition?.id} game={game} editions={editions} selectedEdition={selectedEdition} />
        <div className="game-detail__specs">
          <dl className="game-detail__facts"><div><dt>Издатель</dt><dd>{game.publisher || '—'}</dd></div><div><dt>Разработчик</dt><dd>{game.developer || '—'}</dd></div><div><dt>Серия</dt><dd>{game.series || '—'}</dd></div><div><dt>Жанры</dt><dd>{game.genres.join(', ') || '—'}</dd></div></dl>
          <GameRatings gameId={game.id} />
          <div className="game-detail__choice"><span>Платформа</span><div className="game-detail__platforms" role="group" aria-label="Выберите платформу">{platforms.map(platform => <button type="button" key={platform} className="badge-platform badge-platform--static" style={getPlatformBadgeStyle(platform)} aria-pressed={selectedEdition?.platform === platform} onClick={() => { if (selectedEdition?.platform !== platform) setSelectedEditionId(editions.find(edition => edition.platform === platform)!.id); }}>{platform}</button>)}</div></div>
          <div className="game-detail__choice"><span>Издание</span><div className="game-detail__editions" role="group" aria-label="Выберите издание">{editions.filter(edition => edition.platform === selectedEdition?.platform).map(edition => <button type="button" key={edition.id} aria-pressed={selectedEdition?.id === edition.id} onClick={() => setSelectedEditionId(edition.id)}>{edition.name}</button>)}{!editions.length && <span>Издания пока не добавлены</span>}</div></div>
        </div>
      </div>
      <div className="game-detail__actions"><button type="button" className="btn-secondary" disabled={!selectedEdition} onClick={() => setCopyFormOpen(true)}><Plus size={16} aria-hidden="true" /><Library size={16} aria-hidden="true" />{selectedEditionCopies.length ? 'В коллекции' : 'В коллекцию'}</button><GameActions onPlaceListing={() => onPlaceListing(selectedEdition?.id)} onPlaceAuction={() => onPlaceAuction(selectedEdition?.id)} /></div>
      <div className="desc-text"><h4>Описание</h4><p>{game.description || 'Описание игры пока не добавлено.'}</p></div>
      {syncError && <p className="market-form__error" role="alert">{syncError}</p>}
      {selectedEdition && selectedEditionCopies.length > 0 && <div className="edition-shelf"><span className="edition-shelf__title">На полке: {selectedEdition.name} ({selectedEdition.platform})</span><div className="edition-shelf__items"><span className="edition-shelf__quantity"><button type="button" aria-label="Уменьшить количество" disabled={selectedEditionCopies.length <= 1} onClick={() => onSetEditionQuantity(selectedEdition.id, selectedEditionCopies.length - 1)}><Minus size={12} /></button><span className="edition-shelf__quantity-value">×{selectedEditionCopies.length}</span><button type="button" aria-label="Добавить экземпляр" disabled={selectedEditionCopies.length >= MAX_COLLECTION_QUANTITY} onClick={() => setCopyFormOpen(true)}><Plus size={12} /></button></span><button type="button" className="edition-shelf__remove" aria-label="Убрать издание с полки" onClick={() => onRemoveEdition(selectedEdition.id)}><X size={12} /></button></div></div>}
      <ApiState loading={marketLoading} error={marketError} onRetry={onRetryMarket} />
      <GameMarketSection game={game} entries={entries} editions={editions} selectedEditionId={selectedEdition?.id ?? ''} activeTab={activeMarketTab} onChangeTab={setActiveMarketTab} onOpenEntry={onOpenMarketEntry} onOpenDiscussions={() => onOpenDiscussions(game.id)} />
    </div>}
  </ModalShell>;
}