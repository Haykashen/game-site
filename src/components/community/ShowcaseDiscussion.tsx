import {useCallback, useState} from 'react';
import {Link} from 'react-router-dom';
import type {CopyShareDto, Paginated, ShowcaseCommentDto, ShowcaseSocialDto} from '@discvault/shared';
import {apiRequest, errorMessage} from '../../api/client';
import {useAuth} from '../../context/AuthContext';
import {useApiResource} from '../../hooks/useApiResource';
import {ApiState} from '../ApiState';
import {AuthorRating} from '../ui/AuthorRating';

const EMPTY: Paginated<ShowcaseCommentDto> = {items: [], total: 0, page: 1, pageSize: 20, hasMore: false};
export function ShowcaseDiscussion({post, onChange}: {post: CopyShareDto; onChange: (social: ShowcaseSocialDto) => void}) {
  const {user, isModerator} = useAuth();
  const [page, setPage] = useState(1); const [body, setBody] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const base = `/api/v1/community/showcase/${post.id}`;
  const load = useCallback((signal: AbortSignal) => apiRequest<Paginated<ShowcaseCommentDto>>(`${base}/comments?page=${page}&pageSize=20`, {signal}), [base, page]);
  const comments = useApiResource(`showcase-comments:${post.id}`, load, EMPTY);
  return <section className="showcase-discussion" aria-labelledby="showcase-comments-title">
    <h3 id="showcase-comments-title">Комментарии <span className="showcase-discussion__count">{post.commentsCount}</span></h3>
    <ApiState loading={comments.isLoading} error={comments.error} onRetry={comments.refresh}/>
    {!comments.isLoading && !comments.error && !comments.data.total && <p className="panel-hint">Комментариев пока нет. Начните обсуждение.</p>}
    <div className="showcase-comments">{comments.data.items.map(comment => <article key={comment.id} className="showcase-comment"><AuthorRating name={comment.author.displayName} userId={comment.author.id} rating={comment.author.rating}/><p>{comment.body}</p><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString('ru-RU')}</time>
      {(comment.author.id === user?.id || isModerator) && <button type="button" className="btn-secondary" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try {onChange(await apiRequest<ShowcaseSocialDto>(`${base}/comments/${comment.id}`, {method:'DELETE'})); if (page > 1 && comments.data.items.length === 1) setPage(value => value - 1); else await comments.refresh();}
        catch (cause) {setError(errorMessage(cause));} finally {setBusy(false);}
      }}>Удалить комментарий</button>}
    </article>)}</div>
    {(page > 1 || comments.data.hasMore) && <div className="showcase-pagination"><button type="button" className="btn-secondary" disabled={page <= 1 || busy || comments.isLoading} onClick={() => setPage(value => value - 1)}>Назад</button><span>{page}</span><button type="button" className="btn-secondary" disabled={!comments.data.hasMore || busy || comments.isLoading} onClick={() => setPage(value => value + 1)}>Далее</button></div>}
    {user ? <form className="showcase-comment-form" onSubmit={async event => {
      event.preventDefault(); if (busy || !body.trim()) return; setBusy(true); setError('');
      try {const next = await apiRequest<ShowcaseSocialDto>(`${base}/comments`, {method:'POST',body:{body}}); onChange(next); setBody(''); const lastPage = Math.max(1, Math.ceil(next.commentsCount / 20)); if (lastPage !== page) setPage(lastPage); else await comments.refresh();}
      catch (cause) {setError(errorMessage(cause));} finally {setBusy(false);}
    }}><label htmlFor="showcase-comment">Ваш комментарий</label><textarea id="showcase-comment" className="form-control" rows={3} maxLength={2000} required value={body} disabled={busy} onChange={event => setBody(event.target.value)} placeholder="Что вам понравилось в этом экземпляре?"/><button className="btn-primary" type="submit" disabled={busy || !body.trim()}>{busy ? 'Отправляем…' : 'Отправить комментарий'}</button></form> : <Link className="btn-secondary" to="/account">Войти, чтобы комментировать</Link>}
    {error && <p className="market-form__error" role="alert">{error}</p>}
  </section>;
}
