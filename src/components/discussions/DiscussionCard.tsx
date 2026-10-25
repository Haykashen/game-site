import { ArrowUpRight, Eye, Gamepad2, MessageSquare, Pin } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { ProfileLink } from '../ProfileLink';
import { cx } from '../../lib/cx';
import { discussionReplyCount } from '../../lib/discussions';
import { commentsCountLabel, formatFeedDate } from '../../lib/feed';
import type { Discussion, Game } from '../../types';

interface DiscussionCardProps {
  discussion: Discussion;
  game: Game | undefined;
  onSelect: (discussionId: string) => void;
}

/** Topic tile used by the community discussions feed. */
export function DiscussionCard({ discussion, game, onSelect }: DiscussionCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(discussion.id);
    }
  };

  return (
    <article
      className={cx('discussion-card', discussion.pinned && 'discussion-card--pinned')}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(discussion.id)}
      onKeyDown={handleKeyDown}
    >
      <div className="discussion-card__top">
        <span className="feed-chip feed-chip--violet">
          <Gamepad2 size={12} aria-hidden="true" />
          {game?.title ?? 'Игра не найдена'}
        </span>
        {discussion.pinned && (
          <span className="feed-chip feed-chip--lime">
            <Pin size={12} aria-hidden="true" />
            Закреплено
          </span>
        )}
        <time className="feed-date" dateTime={discussion.updatedAt}>
          {formatFeedDate(discussion.updatedAt)}
        </time>
      </div>

      <h2 className="discussion-card__title">{discussion.title}</h2>
      <p className="discussion-card__excerpt">{discussion.excerpt}</p>

      <div className="feed-tags">
        {discussion.tags.map((tag) => (
          <span className="feed-tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>

      <footer className="feed-card__footer">
        <span className="feed-author">
          <span className="feed-avatar" aria-hidden="true">
            {discussion.author.slice(0, 1).toUpperCase()}
          </span>
          <ProfileLink name={discussion.author} userId={discussion.authorId} />
        </span>
        <span className="feed-stats">
          <MessageSquare size={13} aria-hidden="true" />
          {commentsCountLabel(discussionReplyCount(discussion))}
        </span>
        <span className="feed-stats">
          <Eye size={13} aria-hidden="true" />
          {discussion.views}
        </span>
        <ArrowUpRight className="feed-card__arrow" size={17} aria-hidden="true" />
      </footer>
    </article>
  );
}
