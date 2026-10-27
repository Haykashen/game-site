import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameDetailDto, GameWithStatsDto } from '@discvault/shared';
import { fetchGameDetail } from '../api/catalog';
import { useCollection } from '../context/CollectionContext';
import { useApiResource } from '../hooks/useApiResource';
import { useMarketEntries } from '../hooks/useMarketEntries';
import { discussionRoutePath } from '../lib/discussions';
import { marketListingPath } from '../lib/market';
import type { GameStats, MarketEntry } from '../types';
import { ApiState } from './ApiState';
import { GameGrid } from './GameGrid';
import { GameModal } from './GameModal';
import { ModalShell } from './ui/ModalShell';

interface GameBrowserProps {
  games: readonly GameWithStatsDto[];
  gameId: string;
  editionId?: string;
  onOpenGame: (gameId: string, editionId?: string) => void;
  onCloseGame: () => void;
  emptyText?: string;
  onEditGame?: (gameId: string) => void;
  suspendDrawer?: boolean;
}

/** Paged cards use server summaries; full editions and market are fetched on open. */
export function GameBrowser({games, gameId, editionId = '', onOpenGame, onCloseGame, emptyText, onEditGame, suspendDrawer = false}: GameBrowserProps) {
  const {copies, addCopy, setEditionQuantity, removeEdition, isSyncing} = useCollection();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(gameId);
  const [ownedCounts, setOwnedCounts] = useState<Record<string, number>>({});
  const editionIds = useRef(new Map<string, Set<string>>());
  const cardStats = useRef(new Map<string, {game: GameWithStatsDto; owned: number; stats: GameStats}>());
  const loadDetail = useCallback((signal: AbortSignal) => selectedId ? fetchGameDetail(selectedId, signal) : Promise.resolve(null), [selectedId]);
  const detail = useApiResource<GameDetailDto | null>('game-detail:' + selectedId, loadDetail, null);
  const market = useMarketEntries({...(selectedId ? {gameId: selectedId} : {}), enabled: Boolean(gameId) && selectedId === gameId});

  useEffect(() => {if (gameId) setSelectedId(gameId);}, [gameId]);
  useEffect(() => {
    if (detail.data) editionIds.current.set(detail.data.id, new Set(detail.data.editions.flatMap((edition) => [edition.id, ...(edition.variants ?? []).map((variant) => variant.id)])));
    if (isSyncing) return;
    setOwnedCounts((previous) => {
      let next = previous;
      for (const [id, ids] of editionIds.current) {
        const count = copies.filter((copy) => ids.has(copy.editionId)).length;
        if (previous[id] !== count) next = {...next, [id]: count};
      }
      return next;
    });
  }, [copies, detail.data, isSyncing]);

  const statsByGame = useMemo(() => {
    const visibleIds = new Set(games.map((game) => game.id));
    for (const id of cardStats.current.keys()) if (!visibleIds.has(id)) cardStats.current.delete(id);
    return new Map(games.map((game): [string, GameStats] => {
      const owned = ownedCounts[game.id] ?? game.stats.ownedCount;
      const cached = cardStats.current.get(game.id);
      if (cached?.game === game && cached.owned === owned) return [game.id, cached.stats];
      const stats: GameStats = {
    platforms: game.stats.platforms,
    editionCount: game.stats.editionCount,
    ownedCount: owned,
    lotsCount: game.stats.lotsCount,
    salesCount: game.stats.salesCount ?? 0,
    purchasesCount: game.stats.purchasesCount ?? 0,
    exchangeCount: game.stats.exchangeCount ?? 0,
    coverImages: game.stats.coverImages ?? (game.coverImage ? [game.coverImage] : []),
    coverImage: game.stats.coverImages?.[0] ?? game.coverImage,
      };
      cardStats.current.set(game.id, {game, owned, stats});
      return [game.id, stats];
    }));
  }, [games, ownedCounts]);

  const openGame = useCallback((id: string) => {setSelectedId(id); onOpenGame(id);}, [onOpenGame]);
  const placeEntry = useCallback((path: string, id?: string) => {
    const params = new URLSearchParams({compose: '1', game: selectedId});
    if (id) params.set('editionId', id);
    navigate(`${path}?${params}`);
  }, [navigate, selectedId]);
  const openMarketEntry = useCallback((entry: MarketEntry) => {
    navigate(`${entry.kind === 'auction' ? '/auctions' : marketListingPath(entry.listingType)}?item=${encodeURIComponent(entry.id)}`);
  }, [navigate]);
  const selectedGame = detail.data?.id === selectedId ? detail.data : null;
  const isOpen = Boolean(gameId) && !suspendDrawer;

  return <>
    <GameGrid games={games} statsByGame={statsByGame} onSelectGame={openGame} emptyText={emptyText ?? 'Игры не найдены'} />
    {isOpen && (!selectedGame || selectedId !== gameId) && <ModalShell isOpen onClose={onCloseGame} labelledBy="loading-game-title">
      <div className="modal-header"><h2 id="loading-game-title">Карточка игры</h2><button type="button" className="btn-secondary" onClick={onCloseGame}>Закрыть</button></div>
      <ApiState loading={detail.isLoading || selectedId !== gameId} error={detail.error} onRetry={detail.refresh} />
    </ModalShell>}
    {selectedGame && selectedId === (gameId || selectedId) && <GameModal
      key={`${selectedGame.id}:${editionId || 'all'}`}
      game={selectedGame} isOpen={isOpen} editions={selectedGame.editions}
      copies={copies} initialEditionId={editionId} entries={market.entries}
      marketLoading={market.isLoading} marketError={market.error} onRetryMarket={market.refresh}
      onClose={onCloseGame} onOpenMarketEntry={openMarketEntry}
      {...(onEditGame ? {onEditGame: () => onEditGame(selectedGame.id)} : {})}
      onOpenDiscussions={(id) => navigate(discussionRoutePath(id))}
      onAddCopy={addCopy} onSetEditionQuantity={setEditionQuantity} onRemoveEdition={removeEdition}
      onPlaceListing={(id) => placeEntry(marketListingPath('sale'), id)}
      onPlaceAuction={(id) => placeEntry('/auctions', id)}
    />}
  </>;
}
