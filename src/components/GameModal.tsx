import { Bookmark, X } from 'lucide-react';
import { getPlatformBadgeStyle } from '../data';
import { cx } from '../lib/cx';
import type { Game, LotDraft, LotType } from '../types';
import { ArtworkPanel } from './modal/ArtworkPanel';
import { LotForm } from './modal/LotForm';
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
  onCreateLot: (draft: LotDraft) => void;
  onChangeTab: (tab: LotType) => void;
}

const MODAL_TITLE_ID = 'modal-title';

/** Detail drawer: collection action, price analytics, specs, lot form and lots. */
export function GameModal({
  game,
  isOpen,
  isOwned,
  activeTab,
  onClose,
  onToggleOwned,
  onCreateLot,
  onChangeTab,
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

      <LotForm onCreateLot={onCreateLot} />

      <LotsSection game={game} activeTab={activeTab} onChangeTab={onChangeTab} />
    </ModalShell>
  );
}
