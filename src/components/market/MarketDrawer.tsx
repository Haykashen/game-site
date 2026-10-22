import { useEffect, useState } from 'react';
import type { Edition, Game, MarketDraft, MarketEntry, MarketKind } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { ComposeEntryForm } from './ComposeEntryForm';
import { MarketEntryDetail } from './MarketEntryDetail';

interface MarketDrawerProps {
  isOpen: boolean;
  isComposing: boolean;
  kind: MarketKind;
  entry: MarketEntry | null;
  game: Game | undefined;
  edition: Edition | undefined;
  games: readonly Game[];
  editions: readonly Edition[];
  initialGameId: string;
  initialEditionId: string;
  onClose: () => void;
  onCreate: (draft: MarketDraft) => void;
  onOpenGame: (gameId: string, editionId?: string) => void;
}

type DrawerView =
  | { type: 'compose' }
  | { type: 'entry'; entry: MarketEntry; game: Game | undefined; edition: Edition | undefined };

const TITLE_ID = 'market-drawer-title';

/**
 * One drawer for both flows: the placement form and the entity card. Keeping a
 * snapshot lets the panel slide out with its last content instead of going blank.
 */
export function MarketDrawer({
  isOpen,
  isComposing,
  kind,
  entry,
  game,
  edition,
  games,
  editions,
  initialGameId,
  initialEditionId,
  onClose,
  onCreate,
  onOpenGame,
}: MarketDrawerProps) {
  const [lastView, setLastView] = useState<DrawerView | null>(null);

  useEffect(() => {
    if (isComposing) {
      setLastView({ type: 'compose' });
    } else if (entry) {
      setLastView({ type: 'entry', entry, game, edition });
    }
  }, [edition, entry, game, isComposing]);

  const view: DrawerView | null = isComposing
    ? { type: 'compose' }
    : entry
      ? { type: 'entry', entry, game, edition }
      : lastView;

  const focusKey = isComposing
    ? `compose-${initialGameId}-${initialEditionId}`
    : (entry?.id ?? 'closed');

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={TITLE_ID}
      focusKey={focusKey}
    >
      {view?.type === 'compose' ? (
        <ComposeEntryForm
          key={`compose-${initialGameId}-${initialEditionId}`}
          kind={kind}
          games={games}
          editions={editions}
          initialGameId={initialGameId}
          initialEditionId={initialEditionId}
          titleId={TITLE_ID}
          onSubmit={onCreate}
          onCancel={onClose}
        />
      ) : view?.type === 'entry' ? (
        <MarketEntryDetail
          entry={view.entry}
          game={view.game}
          edition={view.edition}
          titleId={TITLE_ID}
          onClose={onClose}
          onOpenGame={onOpenGame}
        />
      ) : null}
    </ModalShell>
  );
}
