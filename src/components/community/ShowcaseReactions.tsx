import {Heart, MessageCircle} from 'lucide-react';
import {useState} from 'react';
import {Link} from 'react-router-dom';
import type {CopyShareDto, ShowcaseSocialDto} from '@discvault/shared';
import {useAuth} from '../../context/AuthContext';
import {apiRequest, errorMessage} from '../../api/client';
interface Props {post: CopyShareDto; onChange: (social: ShowcaseSocialDto) => void; onComments?: () => void}
export function ShowcaseReactions({post, onChange, onComments}: Props) {
  const {user} = useAuth(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <div><div className="showcase-reactions">
    {user ? <button type="button" className="btn-secondary showcase-like" aria-label={post.likedByMe ? 'Снять лайк' : 'Поставить лайк'} aria-pressed={post.likedByMe} disabled={busy} onClick={async () => {
      if (busy) return; setBusy(true); setError('');
      try {onChange(await apiRequest<ShowcaseSocialDto>(`/api/v1/community/showcase/${post.id}/like`, {method: post.likedByMe ? 'DELETE' : 'PUT'}));}
      catch (cause) {setError(errorMessage(cause));} finally {setBusy(false);}
    }}><Heart size={17} fill={post.likedByMe ? 'currentColor' : 'none'} /><span>{post.likesCount}</span></button> : <Link className="btn-secondary" to="/account" aria-label="Войти, чтобы поставить лайк"><Heart size={17}/>{post.likesCount}</Link>}
    {onComments ? <button className="btn-secondary" type="button" onClick={onComments} aria-label="Открыть комментарии"><MessageCircle size={17}/>{post.commentsCount}</button> : <span className="showcase-comment-count"><MessageCircle size={17}/>{post.commentsCount}</span>}
  </div>{error && <p className="market-form__error" role="alert">{error}</p>}</div>;
}
