import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection } from '../context/CollectionContext';
import type { Game, LotType } from '../types';
import { GameGrid } from './GameGrid';
import { GameModal } from './GameModal';

interface GameBrowserProps {
  games: readonly Game[];
  /** Game id from the URL: links, reloads and history all drive the drawer. */
  gameId: string;
  onOpenGame: (gameId: string) => void;
  onCloseGame: () => void;
  emptyText?: string;
}

/**
 * Shared grid + detail drawer. Selection lives here so the catalogue and the
 * collection page get identical modal behaviour without duplicating state.
 */
export function GameBrowser({
  games,
  gameId,
  onOpenGame,
  onCloseGame,
  emptyText,
}: GameBrowserProps) {
  const { games: allGames, ownedIds, isOwned, toggleOwned } = useCollection();
  const navigate = useNavigate();
  const [selectedGameId, setSelectedGameId] = useState<string | null>(gameId || null);
  const [isModalOpen, setIsModalOpen] = useState(Boolean(gameId));
  const [activeLotTab, setActiveLotTab] = useState<LotType>('sale');

  useEffect(() => {
    if (!gameId) {
      setIsModalOpen(false);
      return;
    }

    if (!allGames.some((game) => game.id === gameId)) return;

    setSelectedGameId(gameId);
    setIsModalOpen(true);
  }, [allGames, gameId]);

  const selectedGame = useMemo(
    () => allGames.find((game) => game.id === selectedGameId) ?? null,
    [allGames, selectedGameId],
  );

  const openGame = useCallback(
    (nextGameId: string) => {
      setSelectedGameId(nextGameId);
      setIsModalOpen(true);
      onOpenGame(nextGameId);
    },
    [onOpenGame],
  );

  const closeGame = useCallback(() => {
    setIsModalOpen(false);
    onCloseGame();
  }, [onCloseGame]);

  const handleToggleOwned = useCallback(() => {
    if (selectedGameId) toggleOwned(selectedGameId);
  }, [selectedGameId, toggleOwned]);

  const placeListing = useCallback(() => {
    if (!selectedGameId) return;
    navigate(`/listings?compose=1&game=${encodeURIComponent(selectedGameId)}`);
  }, [navigate, selectedGameId]);

  const placeAuction = useCallback(() => {
    if (!selectedGameId) return;
    navigate(`/auctions?compose=1&game=${encodeURIComponent(selectedGameId)}`);
  }, [navigate, selectedGameId]);

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
          onChangeTab={setActiveLotTab}
          onPlaceListing={placeListing}
          onPlaceAuction={placeAuction}
        />
      )}
    </>
  );
}
