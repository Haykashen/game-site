import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection } from '../context/CollectionContext';
import { useMarketEntries } from '../hooks/useMarketEntries';
import { discussionRoutePath } from '../lib/discussions';
import { gameCoverImage } from '../lib/editions';
import { marketListingPath } from '../lib/market';
import type { Game, GameStats, MarketEntry } from '../types';
import { GameGrid } from './GameGrid';
import { GameModal } from './GameModal';

interface GameBrowserProps {
  games: readonly Game[];
  /** Game id from the URL: links, reloads and history all drive the drawer. */
  gameId: string;
  /** Optional edition preselected in the drawer. */
  editionId?: string;
  onOpenGame: (gameId: string, editionId?: string) => void;
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
  editionId = '',
  onOpenGame,
  onCloseGame,
  emptyText,
}: GameBrowserProps) {
  const {
    games: allGames,
    editions,
    copies,
    addCopy,
    setEditionQuantity,
    removeEdition,
  } = useCollection();
  const { entries: marketEntries } = useMarketEntries();
  const navigate = useNavigate();
  const [selectedGameId, setSelectedGameId] = useState<string | null>(gameId || null);
  const [isModalOpen, setIsModalOpen] = useState(Boolean(gameId));

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

  const gameEditions = useMemo(
    () => (selectedGame ? editions.filter((edition) => edition.gameId === selectedGame.id) : []),
    [editions, selectedGame],
  );

  const gameCopies = useMemo(
    () => copies.filter((copy) => gameEditions.some((edition) => edition.id === copy.editionId)),
    [copies, gameEditions],
  );

  const statsByGame = useMemo(() => {
    const ownedByGame = new Map<string, number>();

    for (const copy of copies) {
      const edition = editions.find((item) => item.id === copy.editionId);
      if (!edition) continue;
      ownedByGame.set(edition.gameId, (ownedByGame.get(edition.gameId) ?? 0) + 1);
    }

    const marketCounts = new Map<string, { lotsCount: number; salesCount: number; purchasesCount: number; exchangeCount: number }>();

    for (const entry of marketEntries) {
      if (entry.status !== 'active' || (entry.moderationStatus && entry.moderationStatus !== 'visible')) continue;
      const counts = marketCounts.get(entry.gameId) ?? { lotsCount: 0, salesCount: 0, purchasesCount: 0, exchangeCount: 0 };
      if (entry.kind === 'auction') counts.lotsCount += 1;
      else if (entry.listingType === 'sale') counts.salesCount += 1;
      else if (entry.listingType === 'purchase') counts.purchasesCount += 1;
      else if (entry.listingType === 'exchange') counts.exchangeCount += 1;
      marketCounts.set(entry.gameId, counts);
    }

    const stats = new Map<string, GameStats>();

    for (const game of allGames) {
      const editionsForGame = editions.filter((edition) => edition.gameId === game.id);
      const platforms = [...new Set(editionsForGame.map((edition) => edition.platform))];

      stats.set(game.id, {
        platforms,
        editionCount: editionsForGame.length,
        ownedCount: ownedByGame.get(game.id) ?? 0,
        lotsCount: marketCounts.get(game.id)?.lotsCount ?? 0,
        salesCount: marketCounts.get(game.id)?.salesCount ?? 0,
        purchasesCount: marketCounts.get(game.id)?.purchasesCount ?? 0,
        exchangeCount: marketCounts.get(game.id)?.exchangeCount ?? 0,
        coverImage: gameCoverImage(game, editionsForGame),
      });
    }

    return stats;
  }, [allGames, copies, editions, marketEntries]);

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

  const placeEntry = useCallback(
    (path: string, selectedEditionId?: string) => {
      if (!selectedGameId) return;

      const params = new URLSearchParams({ compose: '1', game: selectedGameId });
      if (selectedEditionId) params.set('editionId', selectedEditionId);

      navigate(`${path}?${params.toString()}`);
    },
    [navigate, selectedGameId],
  );

  const placeListing = useCallback(
    (selectedEditionId?: string) =>
      placeEntry(marketListingPath('sale'), selectedEditionId),
    [placeEntry],
  );

  const placeAuction = useCallback(
    (selectedEditionId?: string) => placeEntry('/auctions', selectedEditionId),
    [placeEntry],
  );

  const openMarketEntry = useCallback(
    (entry: MarketEntry) => {
      const path =
        entry.kind === 'auction'
          ? '/auctions'
          : marketListingPath(entry.listingType);
      navigate(`${path}?item=${encodeURIComponent(entry.id)}`);
    },
    [navigate],
  );

  const openGameDiscussions = useCallback(
    (targetGameId: string) => {
      navigate(discussionRoutePath(targetGameId));
    },
    [navigate],
  );

  return (
    <>
      <GameGrid
        games={games}
        statsByGame={statsByGame}
        onSelectGame={openGame}
        emptyText={emptyText ?? 'Игры не найдены'}
      />

      {selectedGame && (
        <GameModal
          key={`${selectedGame.id}:${editionId || 'all'}`}
          game={selectedGame}
          isOpen={isModalOpen}
          editions={gameEditions}
          copies={gameCopies}
          initialEditionId={editionId}
          entries={marketEntries}
          onClose={closeGame}
          onOpenMarketEntry={openMarketEntry}
          onOpenDiscussions={openGameDiscussions}
          onAddCopy={addCopy}
          onSetEditionQuantity={setEditionQuantity}
          onRemoveEdition={removeEdition}
          onPlaceListing={placeListing}
          onPlaceAuction={placeAuction}
        />
      )}
    </>
  );
}
