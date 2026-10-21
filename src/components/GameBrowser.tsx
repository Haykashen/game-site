import { useCallback, useMemo, useState } from 'react';
import { useCollection } from '../context/CollectionContext';
import type { Game, LotDraft, LotType } from '../types';
import { GameGrid } from './GameGrid';
import { GameModal } from './GameModal';

interface GameBrowserProps {
  games: readonly Game[];
  emptyText?: string;
}

/**
 * Shared grid + detail drawer. Selection lives here so the catalogue and the
 * collection page get identical modal behaviour without duplicating state.
 */
export function GameBrowser({ games, emptyText }: GameBrowserProps) {
  const { games: allGames, ownedIds, isOwned, toggleOwned, addLot } = useCollection();
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeLotTab, setActiveLotTab] = useState<LotType>('sale');

  const selectedGame = useMemo(
    () => allGames.find((game) => game.id === selectedGameId) ?? null,
    [allGames, selectedGameId],
  );

  const openGame = useCallback((gameId: string) => {
    setSelectedGameId(gameId);
    setIsModalOpen(true);
  }, []);

  const closeGame = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleToggleOwned = useCallback(() => {
    if (selectedGameId) toggleOwned(selectedGameId);
  }, [selectedGameId, toggleOwned]);

  const handleCreateLot = useCallback(
    (draft: LotDraft) => {
      if (selectedGameId) addLot(selectedGameId, draft);
    },
    [selectedGameId, addLot],
  );

  return (
    <>
      <GameGrid
        games={games}
        ownedIds={ownedIds}
        onSelectGame={openGame}
        emptyText={emptyText ?? 'Игры не найдены'}
      />

      {selectedGame && (
        <GameModal
          game={selectedGame}
          isOpen={isModalOpen}
          isOwned={isOwned(selectedGame.id)}
          activeTab={activeLotTab}
          onClose={closeGame}
          onToggleOwned={handleToggleOwned}
          onCreateLot={handleCreateLot}
          onChangeTab={setActiveLotTab}
        />
      )}
    </>
  );
}
