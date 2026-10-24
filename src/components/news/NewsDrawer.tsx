import { ArrowUpRight, Clock, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cx } from '../../lib/cx';
import { formatFeedDate, readingTimeLabel } from '../../lib/feed';
import { NEWS_CATEGORY_META } from '../../lib/news';
import type { Game, NewsPost } from '../../types';
import { IconButton } from '../ui/IconButton';
import { ModalShell } from '../ui/ModalShell';

const TITLE_ID = 'news-detail-title';

interface NewsDrawerProps {
  post: NewsPost | null;
  game: Game | undefined;
  onClose: () => void;
}

/** Full news card with the article body and related catalogue links. */
export function NewsDrawer({ post, game, onClose }: NewsDrawerProps) {
  const meta = post ? NEWS_CATEGORY_META[post.category] : null;
  const Icon = meta?.icon;

  return (
    <ModalShell
      isOpen={Boolean(post)}
      onClose={onClose}
      labelledBy={TITLE_ID}
      focusKey={post?.id ?? ''}
    >
      {post && meta && Icon && (
        <div className={cx('news-detail', `news-detail--${post.category}`)}>
          <div className="modal-header">
            <div>
              <div className="modal-header-meta">
                <span className="feed-chip feed-chip--news feed-chip--static">
                  <Icon size={12} aria-hidden="true" />
                  {meta.label}
                </span>
                <span className="meta-chip">{formatFeedDate(post.publishedAt)}</span>
                <span className="meta-chip">{readingTimeLabel(post.body)}</span>
              </div>
              <h2 className="modal-title" id={TITLE_ID}>
                {post.title}
              </h2>
            </div>
            <IconButton label="Закрыть" transparent onClick={onClose}>
              <X size={20} />
            </IconButton>
          </div>

          <div
            className={cx('news-detail__hero', `news-detail__hero--${post.category}`)}
            aria-hidden="true"
          >
            <span className="news-detail__hero-grid" />
            <span className="news-detail__hero-kicker">DISCVAULT / NEWS</span>
            <span className="news-detail__hero-icon">
              <Icon size={64} strokeWidth={1.2} />
            </span>
            <span className="news-detail__hero-label">{meta.label}</span>
          </div>

          <p className="news-detail__lead">{post.excerpt}</p>

          <div className="news-detail__body">
            {post.body.split('\n\n').map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div className="feed-tags">
            {post.tags.map((tag) => (
              <span className="feed-tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>

          <div className="news-detail__footer">
            <span className="feed-author">
              <span className="feed-avatar" aria-hidden="true">
                {post.author.slice(0, 1).toUpperCase()}
              </span>
              {post.author}
            </span>
            <span className="feed-stats">
              <Clock size={14} aria-hidden="true" />
              {readingTimeLabel(post.body)} чтения
            </span>

            <div className="news-detail__links">
              {game && (
                <Link
                  to={`/games?game=${encodeURIComponent(game.id)}`}
                  className="btn-secondary"
                  onClick={onClose}
                >
                  К игре: {game.title}
                </Link>
              )}
              <Link
                to="/news"
                className="btn-secondary news-detail__all"
                onClick={onClose}
              >
                Все новости
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
