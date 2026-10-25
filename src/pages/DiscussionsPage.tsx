import { MessagesSquare } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { DiscussionCard } from '../components/discussions/DiscussionCard';
import { DiscussionDrawer } from '../components/discussions/DiscussionDrawer';
import { FeedEmpty } from '../components/feed/FeedEmpty';
import { PageHeading } from '../components/PageHeading';
import { SearchToolbar } from '../components/SearchToolbar';
import { useAuth } from '../context/AuthContext';
import { INITIAL_GAMES } from '../data';
import { useDiscussions } from '../hooks/useDiscussions';
import { useItemPanelParam } from '../hooks/useItemPanelParam';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { topicsCountLabel } from '../lib/feed';
import type { SearchFilterField, UrlFilterField } from '../lib/searchFilterConfig';

type DiscussionFilterKey = 'query' | 'game';

const DISCUSSION_FILTER_PARAMS: readonly UrlFilterField<DiscussionFilterKey>[] = [
  { key: 'query', param: 'q' },
  { key: 'game', param: 'game' },
];

const DISCUSSION_FILTER_FIELDS: readonly SearchFilterField<DiscussionFilterKey>[] = [
  {
    id: 'discussionGameFilter',
    key: 'game',
    label: 'Игра',
    placeholder: 'Все игры',
    options: INITIAL_GAMES.map((game) => ({ value: game.id, label: game.title })),
  },
];

const GAME_BY_ID = new Map(INITIAL_GAMES.map((game) => [game.id, game]));

/** Community feed with URL-backed search, game filter and a discussion drawer. */
export function DiscussionsPage() {
  const { values, setValue, reset } = useUrlFilters(DISCUSSION_FILTER_PARAMS);
  const { itemId, openItem, closeItem } = useItemPanelParam();
  const { user, isApiMode } = useAuth();
  const {
    discussions: allDiscussions,
    isLoading,
    isDetailLoading,
    error,
    detailError,
    loadDiscussion,
    reply,
  } = useDiscussions();

  useEffect(() => {
    if (itemId) void loadDiscussion(itemId);
  }, [itemId, loadDiscussion]);

  const discussions = useMemo(() => {
    const query = values.query.trim().toLocaleLowerCase('ru-RU');

    return allDiscussions
      .filter((discussion) => {
        if (values.game && discussion.gameId !== values.game) return false;
        if (!query) return true;

        const game = GAME_BY_ID.get(discussion.gameId);

        return [
          discussion.title,
          discussion.excerpt,
          discussion.body,
          discussion.author,
          ...discussion.tags,
          game?.title ?? '',
        ]
          .join(' ')
          .toLocaleLowerCase('ru-RU')
          .includes(query);
      })
      .sort(
        (left, right) =>
          Number(right.pinned) - Number(left.pinned) ||
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      );
  }, [allDiscussions, values.game, values.query]);

  const selectedDiscussion = itemId
    ? allDiscussions.find((discussion) => discussion.id === itemId) ?? null
    : null;
  const selectedGame = selectedDiscussion
    ? GAME_BY_ID.get(selectedDiscussion.gameId)
    : undefined;

  const handleReset = () => {
    reset();
    closeItem();
  };

  return (
    <>
      <PageHeading
        eyebrow="COMMUNITY / DISCUSSIONS"
        title="Обсуждения"
        description="Темы коллекционеров об изданиях, регионах и поиске дисков для полки."
      />

      <SearchToolbar
        idPrefix="discussion"
        ariaLabel="Поиск по обсуждениям"
        searchPlaceholder="Найти тему, игру или автора"
        query={values.query}
        filterValues={values}
        fields={DISCUSSION_FILTER_FIELDS}
        resultCountLabel={topicsCountLabel(discussions.length)}
        onQueryChange={(query) => setValue('query', query)}
        onFilterChange={(key, value) => setValue(key, value)}
        onReset={handleReset}
      />

      {error && (
        <p className="feed-sync-note" role="status">
          Сервер обсуждений недоступен — показаны демонстрационные темы.
        </p>
      )}

      {discussions.length === 0 ? (
        <FeedEmpty
          icon={MessagesSquare}
          title="Обсуждения не найдены"
          description="Попробуйте изменить запрос или сбросить фильтр по игре."
          action={
            <button type="button" className="btn-secondary" onClick={handleReset}>
              Сбросить фильтры
            </button>
          }
        />
      ) : (
        <div className="discussion-grid" aria-busy={isLoading}>
          {discussions.map((discussion) => (
            <DiscussionCard
              key={discussion.id}
              discussion={discussion}
              game={GAME_BY_ID.get(discussion.gameId)}
              onSelect={openItem}
            />
          ))}
        </div>
      )}

      <DiscussionDrawer
        discussion={selectedDiscussion}
        game={selectedGame}
        isApiMode={isApiMode}
        isAuthenticated={Boolean(user)}
        isLoading={isDetailLoading}
        error={detailError}
        onReply={reply}
        onClose={closeItem}
      />
    </>
  );
}
