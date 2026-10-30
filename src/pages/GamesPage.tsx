import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { AdminRecord } from '@discvault/shared';
import { GameBrowser } from '../components/GameBrowser';
import { ApiState } from '../components/ApiState';
import { SearchToolbar } from '../components/SearchToolbar';
import { useGameDrawerParam } from '../hooks/useGameDrawerParam';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { SEARCH_FILTER_PARAMS } from '../lib/searchFilterConfig';
import { useSearchFields } from '../hooks/useSearchFields';
import { useInfiniteCatalog } from '../hooks/useInfiniteCatalog';
import { useAuth } from '../context/AuthContext';
import { useAdminTables } from '../hooks/useAdminTables';
import { AdminRecordDialog, type AdminEditor } from '../components/admin/AdminRecordDialog';

function gamesCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} игра`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} игры`;
  return `${count} игр`;
}

/** Catalogue with URL-backed filters, grid and the game detail drawer. */
export function GamesPage() {
  const fields = useSearchFields('catalog');
  const {user, isAdmin, isModerator, refresh: refreshAuth, status} = useAuth();
  const schema = useAdminTables();
  const gameTable = schema.data.find((table) => table.name === 'Game');
  const [editor, setEditor] = useState<AdminEditor | null>(null);
  const [browserRevision, setBrowserRevision] = useState(0);
  const [notice, setNotice] = useState('');
  useEffect(() => {setEditor(null); setNotice('');}, [user?.id]);
  const { gameId, editionId, openGame, closeGame } = useGameDrawerParam();
  const { values: filters, setValue, reset } = useUrlFilters(SEARCH_FILTER_PARAMS);

  const catalog = useInfiniteCatalog(filters);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !catalog.canLoad || catalog.loading || catalog.error || !catalog.hasMore || gameId || editor || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      // A focused manual-load button can follow the page end as content grows.
      // Keep keyboard paging deliberate instead of draining the catalogue.
      if (!target.contains(document.activeElement) && entries.some((entry) => entry.isIntersecting)) void catalog.loadMore();
    }, {rootMargin: '600px 0px'});
    observer.observe(target);
    return () => observer.disconnect();
  }, [catalog.canLoad, catalog.loading, catalog.error, catalog.hasMore, catalog.loadMore, gameId, editor]);

  async function saved(record?: AdminRecord) {
    if (editor?.mode === 'delete') closeGame();
    await catalog.refresh();
    setBrowserRevision((revision) => revision + 1);
    setNotice(editor?.mode === 'create' ? 'Игра добавлена.' : editor?.mode === 'delete' ? 'Игра удалена.' : 'Изменения игры сохранены.');
    if (editor?.mode === 'create' && typeof record?.id === 'string') openGame(record.id);
    window.scrollTo(0, 0);
  }

  return (
    <>
      <h1 className="sr-only">Каталог игр</h1>
      <SearchToolbar
        idPrefix="catalog"
        ariaLabel="Поиск и фильтры каталога"
        searchPlaceholder="Найти игру по названию"
        query={filters.query}
        filterValues={filters}
        fields={fields}
        resultCountLabel={gamesCountLabel(catalog.total)}
        onQueryChange={(query) => setValue('query', query)}
        onFilterChange={setValue}
        onReset={reset}
        actions={isAdmin ? <button type="button" className="btn-primary" disabled={!gameTable} onClick={() => setEditor({mode: 'create', key: null})}><Plus size={16} aria-hidden="true" />Добавить игру</button> : undefined}
      />
      <ApiState loading={catalog.loading} error={catalog.error ?? (isModerator ? schema.error : null)} onRetry={async () => {
        if (status === 'offline') { await refreshAuth(); return; }
        await Promise.all([catalog.error ? catalog.loadMore() : Promise.resolve(), isModerator && schema.error ? schema.refresh() : Promise.resolve()]);
      }} />
      {notice && <p className="admin-data__help" role="status">{notice}</p>}
      <GameBrowser
        key={`${user?.id ?? 'guest'}:${browserRevision}`}
        games={catalog.items}
        gameId={gameId}
        editionId={editionId}
        onOpenGame={openGame}
        onCloseGame={closeGame}
        suspendDrawer={isModerator && Boolean(editor)}
        {...(isModerator && gameTable ? {onEditGame: (id: string) => setEditor({mode: 'edit', key: JSON.stringify({id})})} : {})}
        emptyText={catalog.loading || catalog.error || status === 'checking' || (isModerator && schema.error) ? '' : 'Игры не найдены'}
      />
      <div ref={sentinel} className="catalog-pagination" aria-live="polite">
        {catalog.items.length > 0 && <span>Показано {catalog.items.length} из {catalog.total}</span>}
        {catalog.hasMore && !catalog.error && catalog.canLoad && <button type="button" className="btn-secondary" disabled={catalog.loading} onClick={(event) => {if (event.detail > 0) event.currentTarget.blur(); void catalog.loadMore();}}>{catalog.loading ? 'Загружаем…' : 'Загрузить ещё'}</button>}
      </div>
      {isModerator && gameTable && editor && <AdminRecordDialog key={`${editor.mode}:${editor.key}`} table={gameTable} editor={editor} title={editor.mode === 'create' ? 'Добавить игру' : editor.mode === 'delete' ? 'Удалить игру' : 'Редактировать игру'} onClose={() => setEditor(null)} onSaved={saved} {...(isAdmin ? {onDelete: () => setEditor({mode: 'delete', key: editor.key})} : {})} />}
    </>
  );
}
