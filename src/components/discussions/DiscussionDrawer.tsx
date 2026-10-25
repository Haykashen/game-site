import {
  Clock,
  CornerDownRight,
  Eye,
  Gamepad2,
  MessageSquare,
  Pin,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  buildDiscussionReplyTree,
  discussionReplyCount,
} from '../../lib/discussions';
import {
  commentsCountLabel,
  formatFeedDate,
  formatFeedDateTime,
  viewsCountLabel,
} from '../../lib/feed';
import type { Discussion, DiscussionComment, Game } from '../../types';
import { IconButton } from '../ui/IconButton';
import { ModalShell } from '../ui/ModalShell';

const TITLE_ID = 'discussion-detail-title';

interface DiscussionDrawerProps {
  discussion: Discussion | null;
  game: Game | undefined;
  isApiMode: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  onReply: (
    discussionId: string,
    body: string,
    parentId?: string | null,
  ) => Promise<string | null>;
  onClose: () => void;
}

interface CommentNodeProps {
  comment: DiscussionComment;
  onReplyClick: (comment: DiscussionComment) => void;
}

/** One message plus its nested answers. Depth is rendered with indentation. */
function CommentNode({ comment, onReplyClick }: CommentNodeProps) {
  const replies = comment.replies ?? [];

  return (
    <li className="discussion-comment">
      <div className="discussion-comment__row">
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
          <button
            type="button"
            className="discussion-comment__reply"
            onClick={() => onReplyClick(comment)}
          >
            <CornerDownRight size={13} aria-hidden="true" />
            Ответить
          </button>
        </div>
      </div>

      {replies.length > 0 && (
        <ul className="discussion-comments__list discussion-comments__list--replies">
          {replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              onReplyClick={onReplyClick}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Full discussion card: opening post, tags and the reply thread. */
export function DiscussionDrawer({
  discussion,
  game,
  isApiMode,
  isAuthenticated,
  isLoading,
  error,
  onReply,
  onClose,
}: DiscussionDrawerProps) {
  const [replyTarget, setReplyTarget] = useState<DiscussionComment | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setReplyTarget(null);
    setReplyBody('');
    setReplyError(null);
    setIsSubmitting(false);
  }, [discussion?.id]);

  const thread = useMemo(
    () => (discussion ? buildDiscussionReplyTree(discussion.comments) : []),
    [discussion],
  );
  const totalReplies = discussion ? discussionReplyCount(discussion) : 0;
  const canReply = !isApiMode || isAuthenticated;

  const handleReplyClick = (comment: DiscussionComment) => {
    setReplyTarget(comment);
    setReplyError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!discussion || isSubmitting) return;

    const body = replyBody.trim();

    if (!body) {
      setReplyError('Напишите текст ответа.');
      return;
    }

    if (!canReply) {
      setReplyError('Войдите, чтобы ответить в обсуждении.');
      return;
    }

    setIsSubmitting(true);
    setReplyError(null);

    const submitError = await onReply(
      discussion.id,
      body,
      replyTarget?.id ?? null,
    );

    setIsSubmitting(false);

    if (submitError) {
      setReplyError(submitError);
      return;
    }

    setReplyBody('');
    setReplyTarget(null);
  };

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
              {commentsCountLabel(totalReplies)}
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
              <span className="feed-count-badge">{totalReplies}</span>
            </div>

            {error && (
              <p className="discussion-comments__error" role="alert">
                {error}
              </p>
            )}

            {isLoading && discussion.comments.length === 0 ? (
              <p className="discussion-comments__empty" role="status">
                Загружаем ответы…
              </p>
            ) : thread.length === 0 ? (
              <p className="discussion-comments__empty">
                Ответов пока нет. Начните обсуждение первым.
              </p>
            ) : (
              <ul className="discussion-comments__list">
                {thread.map((comment) => (
                  <CommentNode
                    key={comment.id}
                    comment={comment}
                    onReplyClick={handleReplyClick}
                  />
                ))}
              </ul>
            )}

            {!canReply ? (
              <p className="discussion-reply-form__hint">
                <Link to="/account" onClick={onClose}>
                  Войдите
                </Link>
                , чтобы отвечать на сообщения в этом обсуждении.
              </p>
            ) : (
              <form className="discussion-reply-form" onSubmit={handleSubmit}>
                <label className="discussion-reply-form__label" htmlFor="discussion-reply-body">
                  {replyTarget ? `Ответ для ${replyTarget.author}` : 'Ваш ответ'}
                </label>
                {replyTarget && (
                  <div className="discussion-reply-form__target">
                    <span>{replyTarget.body}</span>
                    <button
                      type="button"
                      className="discussion-reply-form__cancel"
                      onClick={() => setReplyTarget(null)}
                    >
                      Отменить ответ
                    </button>
                  </div>
                )}
                <textarea
                  id="discussion-reply-body"
                  className="discussion-reply-form__input"
                  rows={3}
                  maxLength={4000}
                  value={replyBody}
                  placeholder="Поделитесь опытом или задайте вопрос участнику"
                  onChange={(event) => setReplyBody(event.target.value)}
                  disabled={isSubmitting}
                />
                {replyError && (
                  <p className="discussion-reply-form__error" role="alert">
                    {replyError}
                  </p>
                )}
                <div className="discussion-reply-form__actions">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSubmitting || replyBody.trim().length === 0}
                  >
                    {isSubmitting ? 'Отправляем…' : 'Отправить'}
                  </button>
                </div>
              </form>
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
