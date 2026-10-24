import { Clock, Eye, Gamepad2, MessageSquare, Pin, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  commentsCountLabel,
  formatFeedDate,
  formatFeedDateTime,
  viewsCountLabel,
} from '../../lib/feed';
import type { Discussion, Game } from '../../types';
import { IconButton } from '../ui/IconButton';
import { ModalShell } from '../ui/ModalShell';

const TITLE_ID = 'discussion-detail-title';

interface DiscussionDrawerProps {
  discussion: Discussion | null;
  game: Game | undefined;
  onClose: () => void;
}

/** Full discussion card: opening post, tags and the reply thread. */
export function DiscussionDrawer({ discussion, game, onClose }: DiscussionDrawerProps) {
  return (
    <ModalShell
      isOpen={Boolean(discussion)}
      onClose={onClose}
      labelledBy={TITLE_ID}
      focusKey={discussion?.id ?? ''}
    >
      {discussion && (
        <>
          <div className="modal-header">
            <div>
              <div className="modal-header-meta">
                {game && (
                  <span className="feed-chip feed-chip--violet">
                    <Gamepad2 size={12} aria-hidden="true" />
                    {game.title}
                  </span>
                )}
                {discussion.pinned && (
                  <span className="feed-chip feed-chip--lime">
                    <Pin size={12} aria-hidden="true" />
                    Закреплено
                  </span>
                )}
                <span className="meta-chip">{formatFeedDate(discussion.createdAt)}</span>
              </div>
              <h2 className="modal-title" id={TITLE_ID}>
                {discussion.title}
              </h2>
            </div>
            <IconButton label="Закрыть" transparent onClick={onClose}>
              <X size={20} />
            </IconButton>
          </div>

          <div className="discussion-detail__meta">
            <span className="feed-author">
              <span className="feed-avatar" aria-hidden="true">
                {discussion.author.slice(0, 1).toUpperCase()}
              </span>
              {discussion.author}
            </span>
            <span className="feed-stats">
              <MessageSquare size={14} aria-hidden="true" />
              {commentsCountLabel(discussion.comments.length)}
            </span>
            <span className="feed-stats">
              <Eye size={14} aria-hidden="true" />
              {viewsCountLabel(discussion.views)}
            </span>
            <span className="feed-stats">
              <Clock size={14} aria-hidden="true" />
              обновлено {formatFeedDate(discussion.updatedAt)}
            </span>
          </div>

          <div className="discussion-detail__body">
            {discussion.body.split('\n\n').map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div className="feed-tags">
            {discussion.tags.map((tag) => (
              <span className="feed-tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>

          <section className="discussion-comments" aria-labelledby="discussion-comments-title">
            <div className="discussion-comments__head">
              <h3 id="discussion-comments-title">Ответы</h3>
              <span className="feed-count-badge">{discussion.comments.length}</span>
            </div>

            {discussion.comments.length === 0 ? (
              <p className="discussion-comments__empty">
                Ответов пока нет. Начните обсуждение первым.
              </p>
            ) : (
              <ul className="discussion-comments__list">
                {discussion.comments.map((comment) => (
                  <li className="discussion-comment" key={comment.id}>
                    <span className="feed-avatar feed-avatar--comment" aria-hidden="true">
                      {comment.author.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="discussion-comment__body">
                      <div className="discussion-comment__head">
                        <span className="feed-author">{comment.author}</span>
                        <time dateTime={comment.createdAt}>
                          {formatFeedDateTime(comment.createdAt)}
                        </time>
                      </div>
                      <p>{comment.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="discussion-detail__actions">
            {game && (
              <Link
                to={`/games?game=${encodeURIComponent(game.id)}`}
                className="btn-secondary"
                onClick={onClose}
              >
                Открыть игру
              </Link>
            )}
            <Link to="/discussions" className="btn-secondary" onClick={onClose}>
              Все обсуждения
            </Link>
          </div>
        </>
      )}
    </ModalShell>
  );
}
