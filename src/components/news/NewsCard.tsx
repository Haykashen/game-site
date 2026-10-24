import { ArrowUpRight, Clock } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { cx } from '../../lib/cx';
import { formatFeedDate, readingTimeLabel } from '../../lib/feed';
import { NEWS_CATEGORY_META } from '../../lib/news';
import type { NewsPost } from '../../types';

interface NewsCardProps {
  post: NewsPost;
  featured?: boolean;
  onSelect: (postId: string) => void;
}

/** Editorial tile used by the news feed. */
export function NewsCard({ post, featured = false, onSelect }: NewsCardProps) {
  const meta = NEWS_CATEGORY_META[post.category];
  const Icon = meta.icon;

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(post.id);
    }
  };

  return (
    <article
      className={cx(
        'news-card',
        `news-card--${post.category}`,
        featured && 'news-card--featured',
      )}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(post.id)}
      onKeyDown={handleKeyDown}
    >
      <div className="news-card__cover" aria-hidden="true">
        <span className="news-card__cover-grid" />
        <span className="news-card__cover-icon">
          <Icon size={featured ? 54 : 38} strokeWidth={1.35} />
        </span>
        <span className="news-card__cover-word">{meta.label}</span>
        <span className="news-card__cover-rule" />
      </div>

      <div className="news-card__body">
        <div className="news-card__meta">
          <span className="feed-chip feed-chip--news">
            <Icon size={12} aria-hidden="true" />
            {meta.label}
          </span>
          <time className="feed-date" dateTime={post.publishedAt}>
            {formatFeedDate(post.publishedAt)}
          </time>
        </div>

        <h2 className="news-card__title">{post.title}</h2>
        <p className="news-card__excerpt">{post.excerpt}</p>

        <div className="feed-tags">
          {post.tags.map((tag) => (
            <span className="feed-tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        <footer className="feed-card__footer">
          <span className="feed-author">
            <span className="feed-avatar" aria-hidden="true">
              {post.author.slice(0, 1).toUpperCase()}
            </span>
            {post.author}
          </span>
          <span className="feed-stats">
            <Clock size={13} aria-hidden="true" />
            {readingTimeLabel(post.body)}
          </span>
          <ArrowUpRight className="feed-card__arrow" size={17} aria-hidden="true" />
        </footer>
      </div>
    </article>
  );
}
