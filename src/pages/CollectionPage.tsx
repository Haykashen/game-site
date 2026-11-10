import { SearchToolbar } from '../components/SearchToolbar';
import type { SearchFilterField } from '../lib/searchFilterConfig';
import { Plus } from 'lucide-react';

import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import shelfArt from '../assets/discvault-shelf.svg';
import { PageHeading } from '../components/PageHeading';
import { CopyCard } from '../components/collection/CopyCard';
import { useCollection } from '../context/CollectionContext';
import { useAuth } from '../context/AuthContext';
import { ApiState } from '../components/ApiState';
import type { Copy, Edition, Game } from '../types';

interface CopyItem {
  copy: Copy;
  photos: string[];
  edition: Edition;
  game: Game;
  quantity: number;
  latestAt: number;
  /** Earliest row is the representative, so bulk edits do not flip card text. */
  firstAt: number;
}

function copiesOnShelf(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) return `${count} экземпляр на полке`;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return `${count} экземпляра на полке`;
  }

  return `${count} экземпляров на полке`;
}

/** Owned copies: every row is a concrete edition, not an abstract game. */
export function CollectionPage() {
  const { user, status } = useAuth();
  const {
    copies,
    editionById,
    games,
    removeEdition,
    isSyncing,
    syncError,
    isCatalogLoading,
    catalogError,
    refresh,
  } = useCollection();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const filterValues = {platform: params.get('platform') ?? '', region: params.get('region') ?? '', edition: params.get('edition') ?? '', condition: params.get('condition') ?? '', completeness: params.get('completeness') ?? ''};
  const setFilter = (key: string, value: string) => setParams(previous => {const next = new URLSearchParams(previous); if(value) next.set(key,value); else next.delete(key); return next;}, {replace:true});
  const resetFilters = () => setParams(previous => {const next = new URLSearchParams(previous); for(const key of ['q','platform','region','edition','condition','completeness']) next.delete(key); return next;}, {replace:true});

  const gamesById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games]);

  const items = useMemo(() => {
    const byEdition = new Map<string, CopyItem>();

    for (const copy of copies) {
      const edition = editionById.get(copy.editionId);
      if (!edition) continue;

      const game = gamesById.get(edition.gameId);
      if (!game) continue;

      const createdAt = Date.parse(copy.createdAt);
      const existing = byEdition.get(edition.id);

      if (existing) {
        existing.quantity += 1;
        existing.photos = createdAt < existing.firstAt ? [...copy.photos, ...existing.photos] : [...existing.photos, ...copy.photos];
        if (createdAt > existing.latestAt) {
          existing.latestAt = createdAt;
        }
        if (createdAt < existing.firstAt) {
          existing.copy = copy;
          existing.firstAt = createdAt;
        }
        continue;
      }

      byEdition.set(edition.id, {
        photos: [...copy.photos],
        copy,
        edition,
        game,
        quantity: 1,
        latestAt: createdAt,
        firstAt: createdAt,
      });
    }

    return [...byEdition.values()].sort((a, b) => b.latestAt - a.latestAt);
  }, [copies, editionById, gamesById]);


  const fieldValue = (item: CopyItem, key: keyof typeof filterValues) => key === 'platform' ? item.edition.platform : key === 'region' ? item.copy.region ?? item.edition.region : key === 'edition' ? item.edition.name : item.copy[key];
  const labels = {platform:'Платформа',region:'Регион',edition:'Издание',condition:'Состояние',completeness:'Комплектность'};
  const fields: SearchFilterField<keyof typeof filterValues>[] = (Object.keys(labels) as (keyof typeof filterValues)[]).map(key => ({id:'collection-'+key,key,label:labels[key],placeholder:'Все',options:[...new Set(items.map(item => fieldValue(item,key)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru',{numeric:true})).map(value => ({value,label:value}))}));
  const visibleItems = items.filter(item => item.game.title.toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU')) && (Object.keys(filterValues) as (keyof typeof filterValues)[]).every(key => !filterValues[key] || fieldValue(item,key) === filterValues[key]));


  return (
    <>
      <PageHeading
        eyebrow="MY SHELF / COLLECTION"
        title="Моя коллекция"
        description={
          items.length > 0
            ? `${copiesOnShelf(copies.length)}. Одна карточка — одно издание; количество экземпляров можно менять.`
            : 'Здесь появятся конкретные издания, которые вы добавите из каталога.'
        }
      />

      <SearchToolbar idPrefix="collection" ariaLabel="Поиск и фильтры коллекции" searchPlaceholder="Найти игру в коллекции" query={query} fields={fields} filterValues={filterValues} onQueryChange={value => setFilter('q',value)} onFilterChange={setFilter} onReset={resetFilters} resultCountLabel={`${visibleItems.length} изданий · ${visibleItems.reduce((sum,item)=>sum+item.quantity,0)} экземпляров`}
        actions={user ? <button type="button" className="btn-primary" onClick={() => navigate('/collection/new')}><Plus size={16} aria-hidden="true" />Пополнить коллекцию</button> : undefined} />
      <ApiState loading={isSyncing || isCatalogLoading} error={syncError ?? catalogError} onRetry={refresh} />
      {status === 'api' && !user && <div className="panel account-notice"><p>Войдите, чтобы увидеть свою коллекцию.</p><Link to="/account" className="btn-secondary">Войти</Link></div>}




      {items.length === 0 && (isSyncing || isCatalogLoading || syncError || catalogError || !user) ? null : items.length === 0 ? (
        <div className="market-empty collection-empty">
          <figure className="collection-empty__art">
            <img
              src={shelfArt}
              alt="Полка DiscVault с играми для приставок, картриджами и CRT-телевизором"
              width={1600}
              height={1000}
              decoding="async"
            />
          </figure>
          <p>В коллекции пока нет экземпляров. Откройте игру и добавьте нужное издание.</p>
          <Link className="market-compose-btn" to="/games">
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <section className="collection-copy-grid" aria-label="Издания в коллекции">
          {!visibleItems.length && <div className="panel"><p>По выбранным условиям ничего не найдено.</p><button type="button" className="btn-secondary" onClick={resetFilters}>Сбросить поиск и фильтры</button></div>}
          {visibleItems.map(({ copy, photos, edition, game, quantity }) => (
            <CopyCard
              key={edition.id}
              copy={copy}
              photos={photos}
              edition={edition}
              game={game}
              quantity={quantity}
              onOpen={() => navigate(`/collection/${encodeURIComponent(edition.id)}`)}
              onEdit={() => navigate(`/collection/${encodeURIComponent(edition.id)}?edit=1`)}
              onRemove={() => removeEdition(edition.id)}
            />
          ))}
        </section>
      )}

    </>
  );
}
