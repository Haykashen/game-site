import { Minus, Pencil, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCollection } from '../context/CollectionContext';
import { getPlatformBadgeStyle } from '../data/reference';
import { MAX_COLLECTION_QUANTITY } from '../lib/constants';
import { editionsCountLabel } from '../lib/market';
import type { Copy, Edition, Game, MarketEntry } from '../types';
import { ArtworkPanel } from './modal/ArtworkPanel';
import { EditionsSection } from './modal/EditionsSection';
import { GameSubscriptionButton } from './GameSubscriptionButton';
import { GameRatings } from './GameRatings';
import { GameActions } from './modal/GameActions';
import { GameMarketSection } from './modal/GameMarketSection';
import type { GameMarketTab } from './modal/GameMarketSection';
import { SpecBox } from './modal/SpecBox';
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
  onAddCopy: (editionId: string) => Promise<boolean>;
  onSetEditionQuantity: (editionId: string, quantity: number) => void;
  onRemoveEdition: (editionId: string) => void;
  onPlaceListing: (editionId?: string) => void;
  onPlaceAuction: (editionId?: string) => void;
}

const MODAL_TITLE_ID = 'modal-title';

/** Detail drawer: abstract game info, concrete editions and game-scoped market. */
export function GameModal({
  marketLoading,
  marketError,
  onRetryMarket,
  onEditGame,
  game,
  isOpen,
  editions,
  copies,
  initialEditionId,
  entries,
  onClose,
  onOpenMarketEntry,
  onOpenDiscussions,
  onAddCopy,
  onSetEditionQuantity,
  onRemoveEdition,
  onPlaceListing,
  onPlaceAuction,
}: GameModalProps) {
  const { syncError } = useCollection();
  const {isAdmin} = useAuth();
  const [activeMarketTab, setActiveMarketTab] = useState<GameMarketTab>('lots');
  const [selectedEditionId, setSelectedEditionId] = useState(() =>
    editions.find((edition) => edition.id === initialEditionId || edition.variants?.some(variant=>variant.id===initialEditionId))?.id ?? editions[0]?.id ?? '',
  );

  const platforms = useMemo(
    () => [...new Set(editions.map((edition) => edition.platform))],
    [editions],
  );

  const selectedEdition = editions.find((edition) => edition.id === selectedEditionId);
  const selectedEditionCopies = selectedEdition
    ? copies.filter((copy) => copy.editionId === selectedEdition.id)
    : [];
  const shelfCopy = selectedEditionCopies[0];
  const shelfMeta = shelfCopy
    ? [...new Set([shelfCopy.condition, shelfCopy.completeness])].join(', ')
    : '';

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} labelledBy={MODAL_TITLE_ID}>
      <ApiState loading={marketLoading} error={marketError} onRetry={onRetryMarket} />
      <div className="modal-header game-modal__header">
        <div>
          <div className="modal-header-meta">
            <div className="game-platforms">
              {platforms.map((platform) => (
                <span
                  key={platform}
                  className="badge-platform badge-platform--static"
                  data-platform={platform}
                  style={getPlatformBadgeStyle(platform)}
                >
                  {platform}
                </span>
              ))}
            </div>
            {game.year !== null && <span className="year">{game.year}</span>}
            <span className="meta-chip">{editionsCountLabel(editions.length)}</span>
            {game.genres.slice(0, 2).map((genre) => (
              <span className="meta-chip" key={genre}>
                {genre}
              </span>
            ))}
          </div>
          <h2 className="modal-title" id={MODAL_TITLE_ID}>
            {game.title}
          </h2>
        </div>
        <div className="game-modal__admin-actions">
          {isAdmin && onEditGame && <button type="button" className="btn-secondary" onClick={onEditGame}><Pencil size={15} aria-hidden="true" />Редактировать игру</button>}
        <IconButton label="Закрыть" transparent onClick={onClose}>
          <X size={20} />
        </IconButton>
        </div>
      </div>

      <ArtworkPanel key={selectedEditionId} game={game} editions={editions} selectedEdition={selectedEdition} />
      <GameRatings gameId={game.id} />

      <div className="desc-grid">
        <div className="desc-text">
          <h4>Описание</h4>
          <p>{game.description || 'Описание игры пока не добавлено.'}</p>
        </div>
        <SpecBox game={game} platforms={platforms} editionCount={editions.length} />
      </div>

      {syncError && <p className="market-form__error" role="alert">{syncError}</p>}
      <EditionsSection
        game={game}
        editions={editions}
        copies={copies}
        selectedEditionId={selectedEditionId}
        onSelectEdition={setSelectedEditionId}
        onAddCopy={onAddCopy}
      />

      {selectedEdition && shelfCopy && (
        <div className="edition-shelf">
          <span className="edition-shelf__title">
            На полке: {selectedEdition.name} ({selectedEdition.platform})
          </span>
          <div className="edition-shelf__items">
            <span className="edition-shelf__item" key={selectedEdition.id}>
              <span>{shelfMeta}</span>
              <span className="edition-shelf__quantity">
                <button
                  type="button"
                  aria-label="Уменьшить количество"
                  disabled={selectedEditionCopies.length <= 1}
                  onClick={() =>
                    onSetEditionQuantity(selectedEdition.id, selectedEditionCopies.length - 1)
                  }
                >
                  <Minus size={12} aria-hidden="true" />
                </button>
                <span className="edition-shelf__quantity-value" aria-live="polite">
                  ×{selectedEditionCopies.length}
                </span>
                <button
                  type="button"
                  aria-label="Увеличить количество"
                  disabled={selectedEditionCopies.length >= MAX_COLLECTION_QUANTITY}
                  onClick={() =>
                    onSetEditionQuantity(selectedEdition.id, selectedEditionCopies.length + 1)
                  }
                >
                  <Plus size={12} aria-hidden="true" />
                </button>
              </span>
              <button
                type="button"
                className="edition-shelf__remove"
                aria-label="Убрать издание с полки"
                onClick={() => onRemoveEdition(selectedEdition.id)}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          </div>
        </div>
      )}

      <div className="game-subscribe-row">
        <GameSubscriptionButton gameId={game.id} />
      </div>

      <GameActions
        onPlaceListing={() => onPlaceListing(selectedEdition?.id)}
        onPlaceAuction={() => onPlaceAuction(selectedEdition?.id)}
      />

      <GameMarketSection
        game={game}
        entries={entries}
        editions={editions}
        selectedEditionId={selectedEditionId}
        onChangeEdition={setSelectedEditionId}
        activeTab={activeMarketTab}
        onChangeTab={setActiveMarketTab}
        onOpenEntry={onOpenMarketEntry}
        onOpenDiscussions={() => onOpenDiscussions(game.id)}
      />
    </ModalShell>
  );
}
