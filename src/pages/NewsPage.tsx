import { Newspaper } from 'lucide-react';
import { useMemo } from 'react';
import { FeedEmpty } from '../components/feed/FeedEmpty';
import { NewsCard } from '../components/news/NewsCard';
import { NewsDrawer } from '../components/news/NewsDrawer';
import { PageHeading } from '../components/PageHeading';
import { SearchToolbar } from '../components/SearchToolbar';
import { useCollection } from '../context/CollectionContext';
import { ApiState } from '../components/ApiState';
import { useNewsFeed } from '../hooks/useNewsFeed';
import { useItemPanelParam } from '../hooks/useItemPanelParam';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { newsCountLabel } from '../lib/feed';
import { NEWS_CATEGORY_OPTIONS } from '../lib/news';
import type { SearchFilterField, UrlFilterField } from '../lib/searchFilterConfig';

type NewsFilterKey = 'query' | 'category';

const NEWS_FILTER_PARAMS: readonly UrlFilterField<NewsFilterKey>[] = [
  { key: 'query', param: 'q' },
  { key: 'category', param: 'category' },
];

const NEWS_FILTER_FIELDS: readonly SearchFilterField<NewsFilterKey>[] = [
  {
    id: 'newsCategoryFilter',
    key: 'category',
    label: 'Раздел',
    placeholder: 'Все разделы',
    options: NEWS_CATEGORY_OPTIONS,
  },
];


/** Editorial feed with URL-backed search, category filter and a news drawer. */
export function NewsPage() {
  const { games } = useCollection();
  const gameById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games]);
  const { values, setValue, reset } = useUrlFilters(NEWS_FILTER_PARAMS);
  const { itemId, openItem, closeItem } = useItemPanelParam();
  const { posts: allPosts, isLoading, error, refresh } = useNewsFeed();

  const news = useMemo(() => {
    const query = values.query.trim().toLocaleLowerCase('ru-RU');

    return allPosts.filter((post) => {
      if (values.category && post.category !== values.category) return false;
      if (!query) return true;

      const game = post.gameId ? gameById.get(post.gameId) : undefined;

      return [post.title, post.excerpt, post.body, post.author, ...post.tags, game?.title ?? '']
        .join(' ')
        .toLocaleLowerCase('ru-RU')
        .includes(query);
    }).sort(
      (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
    );
  }, [allPosts, gameById, values.category, values.query]);

  const selectedNews = itemId
    ? allPosts.find((post) => post.id === itemId) ?? null
    : null;
  const selectedGame = selectedNews?.gameId
    ? gameById.get(selectedNews.gameId)
    : undefined;

  const handleReset = () => {
    reset();
    closeItem();
  };

  return (
    <>
      <PageHeading
        eyebrow="COMMUNITY / NEWS"
        title="Новости"
        description="Релизы, находки для коллекции и заметки редакции DiscVault."
      />

      <SearchToolbar
        idPrefix="news"
        ariaLabel="Поиск по новостям"
        searchPlaceholder="Найти новость, игру или тему"
        query={values.query}
        filterValues={values}
        fields={NEWS_FILTER_FIELDS}
        resultCountLabel={newsCountLabel(news.length)}
        onQueryChange={(query) => setValue('query', query)}
        onFilterChange={(key, value) => setValue(key, value)}
        onReset={handleReset}
      />

      <ApiState loading={isLoading} error={error} onRetry={refresh} />

      {isLoading || error ? null : news.length === 0 ? (
        <FeedEmpty
          icon={Newspaper}
          title="Новости не найдены"
          description="Попробуйте изменить запрос или выбрать другой раздел."
          action={
            <button type="button" className="btn-secondary" onClick={handleReset}>
              Сбросить фильтры
            </button>
          }
        />
      ) : (
        <div className="news-grid" aria-busy={isLoading}>
          {news.map((post, index) => (
            <NewsCard
              key={post.id}
              post={post}
              featured={index === 0 && news.length > 1}
              onSelect={openItem}
            />
          ))}
        </div>
      )}

      <NewsDrawer post={selectedNews} game={selectedGame} onClose={closeItem} />
    </>
  );
}
