import {MessageCircle} from 'lucide-react';
import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import type {CopyShareDto, ShowcaseSocialDto} from '@discvault/shared';
import {useAuth} from '../../context/AuthContext';
import {apiRequest, errorMessage} from '../../api/client';
interface Props {post: CopyShareDto; onChange: (social: ShowcaseSocialDto) => void; onComments?: () => void; showComments?: boolean}
const trophyPath = 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z';
export function showcaseLikeTier(count: number) {return count >= 30 ? 4 : count >= 15 ? 3 : count >= 5 ? 2 : count >= 1 ? 1 : 0;}
const ranks = ['Оценить экземпляр', 'Хороший экземпляр', 'Редкое издание', 'Эпическая редкость', 'Легендарный экспонат'];
function Trophy() {return <svg className="showcase-trophy-icon" width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={trophyPath}/></svg>;}
export function ShowcaseReactions({post, onChange, onComments, showComments = true}: Props) {
  const {user} = useAuth(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [burst, setBurst] = useState(0);
  useEffect(() => {if (!burst) return; const timer = setTimeout(() => setBurst(0), 600); return () => clearTimeout(timer);}, [burst]);
  const tier = showcaseLikeTier(post.likesCount);
  const likeClass = 'btn-secondary showcase-like showcase-trophy tier-' + tier + (burst ? ' is-celebrating' : '');
  return <div className="showcase-reactions-block"><div className="showcase-reactions">
    {user ? <button type="button" className={likeClass} title={ranks[tier]} aria-label={post.likedByMe ? 'Снять лайк' : 'Поставить лайк'} aria-pressed={post.likedByMe} disabled={busy} onClick={async () => {
      if (busy) return; setBusy(true); setError('');
      try {const social = await apiRequest<ShowcaseSocialDto>(`/api/v1/community/showcase/${post.id}/like`, {method: post.likedByMe ? 'DELETE' : 'PUT'}); onChange(social); if (!post.likedByMe && social.likedByMe) setBurst(value => value + 1);}
      catch (cause) {setError(errorMessage(cause));} finally {setBusy(false);}
    }}><Trophy/><span>{post.likesCount}</span>{burst > 0 && Array.from({length:8}, (_, i) => <span key={burst+'-'+i} className="showcase-trophy-particle" aria-hidden="true" style={{'--tx': Math.cos(Math.PI*2*i/8)*30+'px', '--ty': Math.sin(Math.PI*2*i/8)*30+'px'} as React.CSSProperties}/>)}</button> : <Link className={likeClass} title={ranks[tier]} to="/account" aria-label="Войти, чтобы поставить лайк"><Trophy/>{post.likesCount}</Link>}
    {showComments && (onComments ? <button className="btn-secondary" type="button" onClick={onComments} aria-label="Открыть комментарии"><MessageCircle size={17}/>{post.commentsCount}</button> : <span className="showcase-comment-count"><MessageCircle size={17}/>{post.commentsCount}</span>)}
  </div>{error && <p className="market-form__error" role="alert">{error}</p>}</div>;
}
