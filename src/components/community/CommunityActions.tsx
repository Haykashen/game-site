import { createPortal } from 'react-dom';
import { IconButton } from '../ui/IconButton';
import { LoadingState } from '../LoadingState';
import { FeedTags } from '../feed/FeedTags';
import { Plus, UserRound, X, CheckCircle2 } from 'lucide-react';
import { useStatusFilter } from '../../hooks/useStatusFilter';
import { useEffect, useState, type SubmitEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { NewsCategory } from '@discvault/shared';
import { apiRequest } from '../../api/client';
import { createDiscussion, createNewsPost } from '../../api/community';
import { useAuth } from '../../context/AuthContext';
import { useCollection } from '../../context/CollectionContext';
import { NEWS_CATEGORY_OPTIONS } from '../../lib/news';
import { GameCombobox } from '../ui/GameCombobox';
import { ModalShell } from '../ui/ModalShell';
import './community.css';

type Submission = { id: string; updatedAt: string; gameId: string | null; category?: NewsCategory; tags: string[]; title: string; body: string; author: { displayName: string }; moderationStatus: string; moderationNote: string | null };
const STATUS: Record<string, string> = { draft: 'Черновик', pending: 'На проверке', visible: 'Проверено', hidden: 'Отклонено', removed: 'Снято с публикации' };
type Mode = 'create' | 'mine' | 'pending';

export function CommunityActions({ kind, onPublished }: { kind: 'news' | 'discussions'; onPublished: () => void }) {
  const { user, isModerator } = useAuth();
  // Remount on account changes so drafts and private submission lists never cross accounts.
  return <CommunityActionsInner key={user?.id ?? 'guest'} kind={kind} onPublished={onPublished} isModerator={isModerator} authenticated={Boolean(user)} />;
}

function CommunityActionsInner({ kind, onPublished, isModerator, authenticated }: { kind: 'news' | 'discussions'; onPublished: () => void; isModerator: boolean; authenticated: boolean }) {
  const { games } = useCollection();
  const [ownActionTarget, setOwnActionTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {setOwnActionTarget(document.getElementById('community-own-action'));}, []);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [game, setGame] = useState('');
  const [category, setCategory] = useState<NewsCategory>('community');
  const [tags, setTags] = useState('');
  const [items, setItems] = useState<Submission[]>([]);
  const statusFilter = useStatusFilter(kind === 'news' ? 'NewsPost' : 'Discussion');
  const [statusId, setStatusId] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState<'draft' | 'pending'>('pending');
  const [sent, setSent] = useState(false);
  const news = kind === 'news';
  const close = () => { if (!busy) { setMode(null); window.dispatchEvent(new CustomEvent('community-own-change', { detail: false })); setError(''); setSent(false); } };
  const open = (next: Mode) => {
    if (!authenticated) { navigate('/account'); return; }
    if (next === 'pending' && !isModerator) return;
    if (next === 'create' && searchParams.get('game')) setGame(searchParams.get('game')!);
    setStatusId(''); setItems([]); setPage(1); setHasMore(false); setError(''); setSent(false); setMode(next); window.dispatchEvent(new CustomEvent('community-own-change', { detail: next === 'mine' }));
  };
  useEffect(() => {
    if (!mode || mode === 'create') return;
    const controller = new AbortController();
    setLoading(true); setError('');
    apiRequest<{ items: Submission[]; total: number }>(
      '/api/v1/' + kind + '?scope=' + mode + '&page=' + page + '&pageSize=20' + (statusId ? '&statusId=' + encodeURIComponent(statusId) : ''), { signal: controller.signal },
    ).then(data => { setItems(previous => page === 1 ? data.items : [...previous, ...data.items]); setHasMore(page * 20 < data.total); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить публикации.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, mode, page, revision, statusId]);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setError('');
    const selected = games.find(item => item.id === game);
    if ((game || !news) && !selected) { setError('Выберите игру из предложенного списка.'); return; }
    const tagList = tags.split(',').map(tag => tag.trim()).filter(Boolean);
    if (tagList.length > 8 || tagList.some(tag => tag.length > 30)) { setError('Добавьте до 8 тегов, каждый не длиннее 30 символов.'); return; }
    setBusy(true);
    try {
      if (news) await createNewsPost({ submissionStatus, title, body, category, tags: tagList, gameId: selected?.id ?? null });
      else await createDiscussion({ submissionStatus, title, body, tags: tagList, gameId: selected!.id });
      setSent(true); setTitle(''); setBody(''); setGame(''); setTags('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось отправить публикацию.'); }
    finally { setBusy(false); }
  }
  async function review(item: Submission, status: 'visible' | 'hidden') {
    if (busy) return;
    const note = notes[item.id]?.trim() ?? '';
    if (status === 'hidden' && !note) { setError('Укажите причину отклонения в комментарии.'); return; }
    setBusy(true); setError('');
    try {
      await apiRequest('/api/v1/' + kind + '/' + encodeURIComponent(item.id) + '/moderation', { method: 'PATCH', body: { status, note, updatedAt: item.updatedAt } });
      setPage(1); setRevision(value => value + 1); onPublished();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить решение.'); }
    finally { setBusy(false); }
  }
  return <>
    {authenticated && ownActionTarget && createPortal(<IconButton label={news ? 'Мои новости' : 'Мои темы'} title={news ? 'Мои новости' : 'Мои темы'} className={'filter-icon-btn market-own-toggle' + (mode === 'mine' ? ' is-active' : '')} aria-pressed={mode === 'mine'} onClick={() => mode === 'mine' ? close() : open('mine')}><UserRound size={17} aria-hidden="true" /></IconButton>, ownActionTarget)}
    <button type="button" className="market-compose-btn market-compose-btn--toolbar" onClick={() => open('create')}><Plus size={18} strokeWidth={2.5} />{news ? 'Создать новость' : 'Создать обсуждение'}</button>
    <CommunityPanel inline={mode === 'mine'} isOpen={mode !== null} onClose={close} labelledBy="community-compose-title" focusKey={mode ?? ''}>
      <div className="community-editor">
        {mode !== 'mine' && <div className="modal-header"><div><div className="eyebrow">СООБЩЕСТВО / {news ? 'НОВОСТИ' : 'ОБСУЖДЕНИЯ'}</div><h2 id="community-compose-title" className="modal-title">{mode === 'create' ? (news ? 'Новая новость' : 'Новое обсуждение') : 'Ожидают модерации'}</h2></div><button type="button" className="btn-icon" aria-label="Закрыть" onClick={close} disabled={busy}><X size={20} /></button></div>}
        {error && <p className="community-error" role="alert">{error}</p>}
        {mode === 'create' && (sent ? <div className="community-success" role="status"><CheckCircle2 size={36} /><h3>{submissionStatus === 'draft' ? 'Черновик сохранён' : 'Отправлено на проверку'}</h3><p>После одобрения материал появится в общей ленте. Статус и комментарий модератора доступны в ваших публикациях.</p><button type="button" className="btn-secondary" onClick={() => open('mine')}>Посмотреть статус</button></div> : <form className="community-form" onSubmit={submit}>
          <p>Поделитесь находкой или начните разговор. Публикация станет видна всем после проверки модератором.</p>
          <label>Заголовок<input value={title} onChange={event => setTitle(event.target.value)} required minLength={3} maxLength={news ? 180 : 160} /></label>
          <label>Игра{news ? ' (необязательно)' : ''}<GameCombobox id="community-game" games={games} value={game} onChange={setGame} required={!news} /></label>
          {news && <label>Раздел<select value={category} onChange={event => setCategory(event.target.value as NewsCategory)}>{NEWS_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
          <label>{news ? 'Текст новости' : 'Текст обсуждения'}<textarea rows={9} value={body} onChange={event => setBody(event.target.value)} required minLength={10} maxLength={news ? 30000 : 20000} /></label>
          <label>Теги (необязательно)<input value={tags} onChange={event => setTags(event.target.value)} placeholder="До 8 тегов через запятую" maxLength={255} /></label>
          <label>Публикация<select value={submissionStatus} onChange={event => setSubmissionStatus(event.target.value as 'draft' | 'pending')}><option value="draft">Сохранить черновик</option><option value="pending">Отправить на проверку</option></select></label>
          <div className="community-form__footer"><button type="button" className="btn-secondary" disabled={busy} onClick={close}>Отмена</button><button type="submit" className="market-compose-btn" disabled={busy}>{busy ? 'Сохраняем…' : submissionStatus === 'draft' ? 'Сохранить черновик' : 'Отправить на проверку'}</button></div>
        </form>)}
        {mode && mode !== 'create' && <div className="community-submissions" aria-busy={loading}>
          {mode === 'pending' && <label>Статус<select className="form-control" value={statusId} onChange={event => {setStatusId(event.target.value);setPage(1);setItems([]);}}><option value="">Все статусы</option>{statusFilter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
          {!loading && !error && items.length === 0 && <p>{mode === 'pending' ? 'Все публикации проверены.' : 'Вы ещё ничего не опубликовали.'}</p>}
          {items.map(item => <article key={item.id} className="community-submission"><span className={'community-status community-status--' + item.moderationStatus}>{STATUS[item.moderationStatus]}</span><h3>{item.title}</h3><p className="community-submission__author">{item.author.displayName}</p><p>{[games.find(game => game.id === item.gameId)?.title, NEWS_CATEGORY_OPTIONS.find(category => category.value === item.category)?.label].filter(Boolean).join(' · ')}</p><div className="community-submission__body">{item.body}</div><FeedTags tags={item.tags} />{item.moderationNote && <p><strong>Комментарий модератора:</strong> {item.moderationNote}</p>}{mode === 'mine' && (item.moderationStatus === 'draft' || item.moderationStatus === 'hidden') && <button type="button" className="btn-secondary" disabled={busy} onClick={async () => {setBusy(true);setError('');try {await apiRequest('/api/v1/' + kind + '/' + encodeURIComponent(item.id) + '/submit', {method: 'POST'});setPage(1);setRevision(value => value + 1);} catch (cause) {setError(cause instanceof Error ? cause.message : 'Не удалось отправить на проверку.');} finally {setBusy(false);}}}>Отправить на проверку</button>}{mode === 'pending' && <div className="community-review"><label>Комментарий модератора<textarea rows={2} maxLength={1000} value={notes[item.id] ?? ''} onChange={event => setNotes(previous => ({ ...previous, [item.id]: event.target.value }))} placeholder="При отклонении укажите причину" /></label><div className="community-form__footer"><button type="button" className="btn-secondary" disabled={busy || loading} onClick={() => void review(item, 'hidden')}>Отклонить</button><button type="button" className="market-compose-btn" disabled={busy || loading} onClick={() => void review(item, 'visible')}>Одобрить и опубликовать</button></div></div>}</article>)}
          {loading && <LoadingState variant="inline" message="Загружаем публикации…" />}
          {error && <button type="button" className="btn-secondary" disabled={loading} onClick={() => {setPage(1);setRevision(value => value + 1);}}>Повторить загрузку</button>}
          {hasMore && !loading && <button type="button" className="btn-secondary" onClick={() => setPage(value => value + 1)}>Показать ещё</button>}
        </div>}
      </div>
    </CommunityPanel>
  </>;
}

function CommunityPanel({ inline, children, ...props }: React.ComponentProps<typeof ModalShell> & { inline: boolean }) {
  const target = document.getElementById('community-own-feed');
  if (inline && target) return createPortal(children, target);
  return <ModalShell {...props}>{children}</ModalShell>;
}