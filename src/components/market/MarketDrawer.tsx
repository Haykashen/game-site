import { useEffect, useState } from 'react';
import type {
  Edition,
  Game,
  MarketDraft,
  MarketEntry,
  MarketKind,
  MarketStatus,
} from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { ComposeEntryForm } from './ComposeEntryForm';
import { MarketEntryDetail } from './MarketEntryDetail';

interface MarketDrawerProps {
  isOpen: boolean;
  isComposing: boolean;
  isEditing: boolean;
  isOwn: boolean;
  isAuthenticated: boolean;
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
  onUpdate: (draft: MarketDraft) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onSetStatus: (status: MarketStatus) => void;
  onPlaceBid: (amount: number) => Promise<string | null>;
  onBuy: () => Promise<string | null>;
  onOpenGame: (gameId: string, editionId?: string) => void;
}

type DrawerView =
  | { type: 'compose' }
  | { type: 'edit'; entry: MarketEntry; game: Game | undefined; edition: Edition | undefined }
  | { type: 'entry'; entry: MarketEntry; game: Game | undefined; edition: Edition | undefined };

const TITLE_ID = 'market-drawer-title';

/**
 * One drawer for both flows: the placement form and the entity card. Keeping a
 * snapshot lets the panel slide out with its last content instead of going blank.
 */
export function MarketDrawer({
  isOpen,
  isComposing,
  isEditing,
  isOwn,
  isAuthenticated,
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
  onUpdate,
  onStartEdit,
  onCancelEdit,
  onDelete,
  onSetStatus,
  onPlaceBid,
  onBuy,
  onOpenGame,
}: MarketDrawerProps) {
  const [lastView, setLastView] = useState<DrawerView | null>(null);

  useEffect(() => {
    if (isComposing) {
      setLastView({ type: 'compose' });
    } else if (entry && isEditing) {
      setLastView({ type: 'edit', entry, game, edition });
    } else if (entry) {
      setLastView({ type: 'entry', entry, game, edition });
    }
  }, [edition, entry, game, isComposing, isEditing]);

  const view: DrawerView | null = isComposing
    ? { type: 'compose' }
    : entry
      ? isEditing
        ? { type: 'edit', entry, game, edition }
        : { type: 'entry', entry, game, edition }
      : lastView;

  const focusKey = isComposing
    ? `compose-${initialGameId}-${initialEditionId}`
    : isEditing
      ? `edit-${entry?.id ?? 'closed'}`
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
      ) : view?.type === 'edit' ? (
        <ComposeEntryForm
          key={`edit-${view.entry.id}`}
          kind={view.entry.kind}
          entry={view.entry}
          games={games}
          editions={editions}
          initialGameId={view.entry.gameId}
          initialEditionId={view.entry.editionId ?? ''}
          titleId={TITLE_ID}
          onSubmit={onUpdate}
          onCancel={onCancelEdit}
        />
      ) : view?.type === 'entry' ? (
        <MarketEntryDetail
          key={view.entry.id}
          entry={view.entry}
          game={view.game}
          edition={view.edition}
          titleId={TITLE_ID}
          isOwn={isOwn}
          isAuthenticated={isAuthenticated}
          onClose={onClose}
          onOpenGame={onOpenGame}
          onEdit={onStartEdit}
          onDelete={onDelete}
          onSetStatus={onSetStatus}
          onPlaceBid={onPlaceBid}
          onBuy={onBuy}
        />
      ) : null}
    </ModalShell>
  );
}
