import { IconButton } from '../components/ui/IconButton';
import {ShowcaseReactions} from '../components/community/ShowcaseReactions';
import {ShowcaseDiscussion} from '../components/community/ShowcaseDiscussion';
import {AuthorRating} from '../components/ui/AuthorRating';
import type {CopyShareDto, Paginated, ShowcaseSocialDto} from '@discvault/shared';
import {useCallback, useEffect, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {EyeOff, Gamepad2, Plus, Share2, X} from 'lucide-react';
import {apiRequest, errorMessage} from '../api/client';
import {useApiResource} from '../hooks/useApiResource';
import {useAuth} from '../context/AuthContext';
import {useCollection} from '../context/CollectionContext';
import {PageHeading} from '../components/PageHeading';
import {ApiState} from '../components/ApiState';
import {ModalShell} from '../components/ui/ModalShell';
import {PlatformBadge} from '../components/ui/PlatformBadge';
import {PhotoPreviewGallery} from '../components/ui/PhotoPreviewGallery';
import {MarketPhotoGallery} from '../components/market/MarketPhotoGallery';
import {completenessLabel} from '../lib/collection';
import {formatMarketCondition} from '../lib/market';
const EMPTY: Paginated<CopyShareDto> = {items: [], total: 0, page: 1, pageSize: 24, hasMore: false};
export function ShowcasePage() {
  const {user} = useAuth();
  const {copies, editionById, games, isSyncing, isCatalogLoading} = useCollection();
  const [page, setPage] = useState(1);
  const load = useCallback((signal: AbortSignal) => apiRequest<Paginated<CopyShareDto>>(`/api/v1/community/showcase?page=${page}&pageSize=24`, {signal}), [page]);
  const feed = useApiResource(`showcase:${user?.id ?? 'guest'}`, load, EMPTY);
  const [params, setParams] = useSearchParams();
  const [composing, setComposing] = useState(Boolean(params.get('copyId')));
  const [copyId, setCopyId] = useState(params.get('copyId') ?? '');
  const [caption, setCaption] = useState('');
  const [topic, setTopic] = useState('');
  const [opened, setOpened] = useState<CopyShareDto | null>(null);
  useEffect(() => {
    const id = params.get('post');
    const post = feed.data.items.find(item => item.id === id);
    if (post) setOpened(post);
  }, [params, feed.data.items]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const options = copies.filter(copy => copy.photos.length && editionById.has(copy.editionId));
  const chosen = options.find(copy => copy.id === copyId) ?? options[0];
  const updateSocial = (id: string, social: ShowcaseSocialDto) => {
    feed.setData(previous => ({...previous, items: previous.items.map(item => item.id === id ? {...item, ...social} : item)}));
    setOpened(previous => previous?.id === id ? {...previous, ...social} : previous);
  };
  const closeCompose = () => {if (!busy) {setComposing(false); setParams({}, {replace: true}); setError('');}};
  const describe = (id: string) => {const edition = editionById.get(id); return edition ? `${games.find(game => game.id === edition.gameId)?.title ?? 'Игра'} · ${edition.name} · ${edition.platform}` : '';};
  async function unpublish(share: CopyShareDto) {
    if (busy || share.author.id !== user?.id) return;
    setBusy(true); setError('');
    try {await apiRequest(`/api/v1/community/showcase/${encodeURIComponent(share.id)}`, {method: 'DELETE'}); setOpened(null); setNotice('Публикация снята. Экземпляр остался в коллекции.'); await feed.refresh();}
    catch (cause) {setError(errorMessage(cause));} finally {setBusy(false);}
  }
  return <><div className="showcase-feed-page">
    <PageHeading eyebrow="COMMUNITY / COLLECTION SHOWCASE" title="Витрина коллекций" description="Экземпляры с историей: делитесь находками, показывайте редкие издания и знакомьтесь с коллекциями других пользователей."
      />
    <div className="showcase-create-bar"><span>Поделитесь находкой из вашей коллекции…</span>{user ? <button type="button" className="btn-primary" onClick={() => {setError('');setComposing(true);}}><Plus size={17} aria-hidden="true" />Поделиться экземпляром</button> : <Link className="btn-secondary" to="/account">Войти, чтобы поделиться</Link>}</div>
    <ApiState loading={feed.isLoading} error={feed.error} onRetry={feed.refresh} />
    {!composing && error && <p className="market-form__error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!feed.isLoading && !feed.error && !feed.data.items.length && <div className="panel showcase-empty"><Share2 size={30} /><h2>Пока никто не поделился экземпляром</h2><p>Опубликуйте фотографии своей находки — она появится здесь.</p></div>}
    <section className="showcase-feed" aria-label="Публикации коллекционеров">{feed.data.items.map(share => <article className="showcase-post" key={share.id} tabIndex={0} aria-label={`Открыть экземпляр: ${share.game.title}`}
      onClick={event => {
        const target = event.target;
        if (target instanceof Element && target.closest('button,a,input,select,textarea,[role="button"]')) return;
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && event.currentTarget.contains(selection.anchorNode)) return;
        setError(''); setOpened(share);
      }}
      onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {event.preventDefault(); setError(''); setOpened(share);} }}>
      <header className="showcase-post__header"><span className="showcase-post__avatar" aria-hidden="true">{share.author.displayName.slice(0,2).toLocaleUpperCase('ru-RU')}</span><div><AuthorRating name={share.author.displayName} userId={share.author.id} rating={share.author.rating} /><time dateTime={share.createdAt}>{new Date(share.createdAt).toLocaleString('ru-RU', {day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}</time></div></header>
      <div className="showcase-post__story"><h2>{share.topic || share.game.title}</h2>{share.caption && <p>{share.caption}</p>}</div>
      <div className="showcase-post__media"><PhotoPreviewGallery photos={share.photos} title={share.game.title} /><div className="card-platforms"><PlatformBadge platform={share.edition.platform} /></div></div>
      <div className="showcase-post__passport"><strong><Gamepad2 size={16} aria-hidden="true" />{share.game.title} · {share.edition.name}</strong><div><span className="edition-chip">{share.region || 'Регион не указан'}</span><span className="edition-chip">{completenessLabel(share.completeness) || 'Комплектность не указана'}</span><span className="edition-chip showcase-post__condition">{formatMarketCondition(share.condition) || 'Состояние не указано'}</span></div></div>
      <footer className="showcase-post__footer"><ShowcaseReactions post={share} onChange={social => updateSocial(share.id, social)} onComments={() => {setError(''); setOpened(share);}}/><button type="button" className="btn-secondary showcase-post__share" onClick={async () => {try {await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#/community/showcase?post=${encodeURIComponent(share.id)}`);setNotice('Ссылка на публикацию скопирована.');}catch{setNotice('Не удалось скопировать ссылку.');}}}><Share2 size={17} aria-hidden="true" />Поделиться</button></footer>
    </article>)}</section>
    {(page > 1 || feed.data.hasMore) && <div className="showcase-pagination"><button className="btn-secondary" disabled={page <= 1 || feed.isLoading} onClick={() => setPage(value => value - 1)}>Назад</button><span>Страница {page}</span><button className="btn-secondary" disabled={!feed.data.hasMore || feed.isLoading} onClick={() => setPage(value => value + 1)}>Далее</button></div>}
    </div>
    <ModalShell isOpen={composing} onClose={closeCompose} labelledBy="share-copy-title">
      <h2 className="modal-title" id="share-copy-title">Поделиться экземпляром</h2>
      {!user ? <Link to="/account" className="btn-primary">Войти</Link> : isSyncing || isCatalogLoading ? <p role="status">Загружаем коллекцию…</p> : !options.length ? <p>Добавьте к экземпляру фотографии в <Link to="/collection">своей коллекции</Link>, чтобы опубликовать его здесь.</p> : <form className="market-form" onSubmit={async event => {
        event.preventDefault(); if (!chosen || busy) return;
        setBusy(true); setError('');
        try {await apiRequest('/api/v1/community/showcase', {method: 'POST', body: {copyId: chosen.id, topic, caption}}); setComposing(false); setParams({}, {replace: true}); setCaption(''); setTopic(''); setNotice('Ваш экземпляр опубликован на витрине.'); if (page === 1) await feed.refresh(); else setPage(1);}
        catch (cause) {setError(errorMessage(cause));} finally {setBusy(false);}
      }}><fieldset disabled={busy} className="copy-form__fields showcase-compose-fields"><label className="form-label" htmlFor="share-copy">Экземпляр из моей коллекции</label><select id="share-copy" className="form-control" value={chosen?.id ?? ''} onChange={event => setCopyId(event.target.value)}>{options.map((copy, index) => <option key={copy.id} value={copy.id}>{describe(copy.editionId)} · экземпляр {index + 1}</option>)}</select>
        {chosen && <MarketPhotoGallery photos={chosen.photos} title={describe(chosen.editionId)} expandable />}
        <label className="form-label" htmlFor="share-topic">Тема</label><textarea id="share-topic" rows={2} className="form-control" maxLength={200} value={topic} onChange={event => setTopic(event.target.value)} placeholder="Коротко о вашей находке…" />
        <label className="form-label" htmlFor="share-caption">Подпись к публикации</label><textarea id="share-caption" rows={4} className="form-control" maxLength={1000} value={caption} onChange={event => setCaption(event.target.value)} placeholder="Расскажите о находке или истории экземпляра…" />
        <p className="panel-hint">Фотографии, состояние, комплектность, регион и подпись будут видны всем. Цена, дата покупки и личные заметки не публикуются. Повторная публикация обновит фото и подпись.</p>
        {error && <p role="alert" className="market-form__error">{error}</p>}<div className="market-form__actions"><button type="button" className="btn-secondary" onClick={closeCompose}>Отмена</button><button type="submit" className="btn-primary">{busy ? 'Публикуем…' : 'Опубликовать'}</button></div></fieldset></form>}
      {!options.length && <button type="button" className="btn-secondary" onClick={closeCompose}>Закрыть</button>}
    </ModalShell>
    <ModalShell isOpen={opened !== null} onClose={() => {if (!busy) setOpened(null);}} labelledBy="showcase-copy-title">
      {opened && <><div className="showcase-publication-heading"><div className="showcase-publication-heading__actions">{opened.author.id === user?.id && <IconButton label="Снять с публикации" title="Снять с публикации" disabled={busy} onClick={() => void unpublish(opened)}><EyeOff size={20} aria-hidden="true" /></IconButton>}<IconButton label="Закрыть публикацию" title="Закрыть публикацию" disabled={busy} onClick={() => setOpened(null)}><X size={20} aria-hidden="true" /></IconButton></div><header className="showcase-post__header"><span className="showcase-post__avatar" aria-hidden="true">{opened.author.displayName.slice(0,2).toLocaleUpperCase('ru-RU')}</span><div><AuthorRating name={opened.author.displayName} userId={opened.author.id} rating={opened.author.rating} /><time dateTime={opened.createdAt}>{new Date(opened.createdAt).toLocaleString('ru-RU', {day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}</time></div></header></div><div className="market-detail-overview showcase-publication-overview"><div className="market-detail-overview__media showcase-publication-overview__photos"><MarketPhotoGallery photos={opened.photos} title={opened.game.title} expandable /></div><dl className="spec-box showcase-publication-specs">
        <div className="spec-row"><dt>Платформа</dt><dd>{opened.edition.platform.replace(/^ps([1-5])$/i, 'PlayStation $1')}</dd></div>
        <div className="spec-row"><dt>Игра</dt><dd>{opened.game.title}</dd></div>
        <div className="spec-row"><dt>Издание</dt><dd>{opened.edition.name}</dd></div>
        <div className="spec-row"><dt>Регион</dt><dd>{opened.region || 'Не указан'}</dd></div>
        <div className="spec-row"><dt>Состояние</dt><dd className="showcase-publication-specs__condition">{formatMarketCondition(opened.condition) || 'Не указано'}</dd></div>
        <div className="spec-row"><dt>Комплектность</dt><dd>{completenessLabel(opened.completeness) || 'Не указана'}</dd></div>
      </dl></div><section className="showcase-publication-story"><h2 id="showcase-copy-title">{opened.topic || opened.game.title}</h2>{opened.caption && <p className="showcase-caption">{opened.caption}</p>}</section><ShowcaseDiscussion key={opened.id} post={opened} onChange={social => updateSocial(opened.id, social)}/>{error && <p role="alert">{error}</p>}</>}
    </ModalShell>
  </>;
}
