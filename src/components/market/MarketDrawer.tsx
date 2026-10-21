import { useEffect, useState } from 'react';
import type { Game, MarketDraft, MarketEntry, MarketKind } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { ComposeEntryForm } from './ComposeEntryForm';
import { MarketEntryDetail } from './MarketEntryDetail';

interface MarketDrawerProps {
  isOpen: boolean;
  isComposing: boolean;
  kind: MarketKind;
  entry: MarketEntry | null;
  game: Game | undefined;
  games: readonly Game[];
  initialGameId: string;
  onClose: () => void;
  onCreate: (draft: MarketDraft) => void;
  onOpenGame: (gameId: string) => void;
}

type DrawerView =
  | { type: 'compose' }
  | { type: 'entry'; entry: MarketEntry; game: Game | undefined };

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
  games,
  initialGameId,
  onClose,
  onCreate,
  onOpenGame,
}: MarketDrawerProps) {
  const [lastView, setLastView] = useState<DrawerView | null>(null);

  useEffect(() => {
    if (isComposing) {
      setLastView({ type: 'compose' });
    } else if (entry) {
      setLastView({ type: 'entry', entry, game });
    }
  }, [isComposing, entry, game]);

  const view: DrawerView | null = isComposing
    ? { type: 'compose' }
    : entry
      ? { type: 'entry', entry, game }
      : lastView;

  const focusKey = isComposing ? `compose-${initialGameId}` : (entry?.id ?? 'closed');

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={TITLE_ID}
      focusKey={focusKey}
    >
      {view?.type === 'compose' ? (
        <ComposeEntryForm
          key={`compose-${initialGameId}`}
          kind={kind}
          games={games}
          initialGameId={initialGameId}
          titleId={TITLE_ID}
          onSubmit={onCreate}
          onCancel={onClose}
        />
      ) : view?.type === 'entry' ? (
        <MarketEntryDetail
          entry={view.entry}
          game={view.game}
          titleId={TITLE_ID}
          onClose={onClose}
          onOpenGame={onOpenGame}
        />
      ) : null}
    </ModalShell>
  );
}
