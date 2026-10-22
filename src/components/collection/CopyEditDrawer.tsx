import { useEffect, useState } from 'react';
import type { Copy, CopyDetails, Edition, Game } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { CopyEditForm } from './CopyEditForm';

interface CopyEditDrawerProps {
  isOpen: boolean;
  copy: Copy | null;
  edition: Edition | null;
  game: Game | null;
  quantity: number;
  onClose: () => void;
  onSave: (details: CopyDetails) => void;
}

interface CopyEditSnapshot {
  copy: Copy;
  edition: Edition;
  game: Game;
  quantity: number;
}

const TITLE_ID = 'collection-copy-title';

/** Drawer shell around the copy editor; keeps content during the exit animation. */
export function CopyEditDrawer({
  isOpen,
  copy,
  edition,
  game,
  quantity,
  onClose,
  onSave,
}: CopyEditDrawerProps) {
  const [lastView, setLastView] = useState<CopyEditSnapshot | null>(null);

  useEffect(() => {
    if (copy && edition && game) {
      setLastView({ copy, edition, game, quantity });
    }
  }, [copy, edition, game, quantity]);

  const view =
    copy && edition && game
      ? { copy, edition, game, quantity }
      : lastView;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={TITLE_ID}
      focusKey={view?.copy.id ?? 'closed'}
    >
      {view ? (
        <CopyEditForm
          key={view.copy.id}
          copy={view.copy}
          edition={view.edition}
          game={view.game}
          quantity={view.quantity}
          titleId={TITLE_ID}
          onSubmit={onSave}
          onCancel={onClose}
        />
      ) : null}
    </ModalShell>
  );
}
