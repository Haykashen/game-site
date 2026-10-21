import { Bookmark, X } from 'lucide-react';
import { getPlatformBadgeStyle } from '../data';
import { cx } from '../lib/cx';
import type { Game, LotType } from '../types';
import { ArtworkPanel } from './modal/ArtworkPanel';
import { GameActions } from './modal/GameActions';
import { LotsSection } from './modal/LotsSection';
import { PriceAnalytics } from './modal/PriceAnalytics';
import { SpecBox } from './modal/SpecBox';
import { IconButton } from './ui/IconButton';
import { ModalShell } from './ui/ModalShell';

interface GameModalProps {
  game: Game;
  isOpen: boolean;
  isOwned: boolean;
  activeTab: LotType;
  onClose: () => void;
  onToggleOwned: () => void;
  onChangeTab: (tab: LotType) => void;
  onPlaceListing: () => void;
  onPlaceAuction: () => void;
}

const MODAL_TITLE_ID = 'modal-title';

/** Detail drawer: collection action, price analytics, specs, actions and lots. */
export function GameModal({
  game,
  isOpen,
  isOwned,
  activeTab,
  onClose,
  onToggleOwned,
  onChangeTab,
  onPlaceListing,
  onPlaceAuction,
}: GameModalProps) {
  const platformStyle = getPlatformBadgeStyle(game.platform);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} labelledBy={MODAL_TITLE_ID}>
      <div className="modal-header">
        <div>
          <div className="modal-header-meta">
            <span
              className="badge-platform"
              data-platform={game.platform}
              style={{ position: 'static', ...(platformStyle ?? {}) }}
            >
              {game.platform}
            </span>
            <span className="year">{game.year}</span>
            {game.region && <span className="meta-chip">{game.region}</span>}
            {game.completeness && <span className="meta-chip">{game.completeness}</span>}
          </div>
          <h2 className="modal-title" id={MODAL_TITLE_ID}>
            {game.title}
          </h2>
          <div className="modal-action-row">
            <button
              type="button"
              className={cx('btn-collection', isOwned && 'owned')}
              onClick={onToggleOwned}
            >
              <Bookmark size={14} />
              <span>{isOwned ? 'Удалить из коллекции' : 'В коллекцию'}</span>
            </button>
          </div>
        </div>
        <IconButton label="Закрыть" transparent onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>

      <PriceAnalytics lots={game.lots} />

      <ArtworkPanel game={game} />

      <div className="desc-grid">
        <div className="desc-text">
          <h4>Описание</h4>
          <p>{game.description}</p>
        </div>
        <SpecBox game={game} />
      </div>

      <GameActions onPlaceListing={onPlaceListing} onPlaceAuction={onPlaceAuction} />

      <LotsSection game={game} activeTab={activeTab} onChangeTab={onChangeTab} />
    </ModalShell>
  );
}
