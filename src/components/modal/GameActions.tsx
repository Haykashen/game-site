import { Gavel, Plus, Tag } from 'lucide-react';

interface GameActionsProps {
  onPlaceListing: () => void;
  onPlaceAuction: () => void;
}

/** Two calls to action in the detail drawer: place a listing or run an auction. */
export function GameActions({ onPlaceListing, onPlaceAuction }: GameActionsProps) {
  return (
    <div className="game-cta" role="group" aria-label="Разместить по этой игре">
      <button
        type="button"
        className="game-cta__btn game-cta__btn--listing"
        onClick={onPlaceListing}
      >
        <Plus size={16} aria-hidden="true" /><Tag size={16} aria-hidden="true" />
        <span>Объявление</span>
      </button>

      <button
        type="button"
        className="game-cta__btn game-cta__btn--auction"
        onClick={onPlaceAuction}
      >
        <Plus size={16} aria-hidden="true" /><Gavel size={16} aria-hidden="true" />
        <span>Аукцион</span>
      </button>
    </div>
  );
}
