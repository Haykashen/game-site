import { QuantityControl } from '../components/collection/QuantityControl';
import { ArrowLeft, ExternalLink, Pencil, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiState } from '../components/ApiState';
import { CopyPhotoGallery } from '../components/collection/CopyPhotoGallery';
import { CompletenessCombobox } from '../components/collection/CompletenessCombobox';
import { GameActions } from '../components/modal/GameActions';
import { IconButton } from '../components/ui/IconButton';
import { ModalShell } from '../components/ui/ModalShell';
import { MoneyInput } from '../components/ui/MoneyInput';
import { PlatformBadge } from '../components/ui/PlatformBadge';
import { UnsavedChangesDialog } from '../components/ui/UnsavedChangesDialog';
import { useCollection } from '../context/CollectionContext';
import { useAuth } from '../context/AuthContext';
import { REGIONS } from '../data/reference';
import { completenessLabel, formatPurchaseDate } from '../lib/collection';
import { copyEditorDetails, copyEditorDirty, copyEditorValues } from '../lib/copyEditor';
import type { CopyEditorValues } from '../lib/copyEditor';
import { formatMarketCondition } from '../lib/market';
import { formatMoneyInput } from '../lib/moneyInput';
import type { Copy, Edition, Game } from '../types';
import { CollectionPage } from './CollectionPage';

export function CollectionCopyPage() {
  const {editionId} = useParams();
  const {user} = useAuth();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const {copies, editionById, games, isSyncing, isCatalogLoading, syncError, catalogError, refresh} = useCollection();
  const group = useMemo(() => copies.filter(copy => (editionById.get(copy.editionId)?.id ?? copy.editionId) === editionId).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)), [copies, editionById, editionId]);
  const edition = editionById.get(editionId ?? '');
  const game = games.find(item => item.id === edition?.gameId);
  const copy = group[0];
  return <>
    <CollectionPage />
    {user && copy && edition && game ? <CollectionCopyDetail key={`${user.id}:${edition.id}`} copy={copy} group={group} edition={edition} game={game} initiallyEditing={search.get('edit') === '1'} /> : <ModalShell isOpen onClose={() => navigate('/collection')} labelledBy="copy-loading-title" contentClassName="copy-detail-modal">
      <h2 id="copy-loading-title">Экземпляр коллекции</h2>
      <ApiState loading={isSyncing || isCatalogLoading} error={syncError ?? catalogError} onRetry={refresh} />
      {!isSyncing && !isCatalogLoading && !syncError && !catalogError && <p>Экземпляр не найден в вашей коллекции.</p>}
      <button type="button" className="btn-secondary" onClick={() => navigate('/collection')}><ArrowLeft size={16} />В коллекцию</button>
    </ModalShell>}
  </>;
}

interface DetailProps {copy: Copy; group: Copy[]; edition: Edition; game: Game; initiallyEditing: boolean}
/** Data comes exclusively from the signed-in owner's collection, never the public catalog. */
export function CollectionCopyDetail({copy, group, edition, game, initiallyEditing}: DetailProps) {
  const navigate = useNavigate();
  const [, setSearch] = useSearchParams();
  const {updateEdition, syncError} = useCollection();
  const photos = useMemo(() => [...new Set(group.flatMap(item => item.photos).filter(Boolean))], [group]);
  const current = useMemo(() => copyEditorValues(copy, edition, photos, group.length), [copy, edition, photos, group.length]);
  const [session, setSession] = useState<{initial: CopyEditorValues; draft: CopyEditorValues} | null>(() => initiallyEditing ? {initial: current, draft: {...current, photos: [...current.photos]}} : null);
  const [saving, setSaving] = useState(false);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [pending, setPending] = useState<{target: string | null} | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const editing = session !== null;
  const dirty = session !== null && copyEditorDirty(session.initial, session.draft);
  const values = session?.draft ?? current;
  const busy = saving || processingPhotos;
  const regions = useMemo(() => [...new Set([...REGIONS, 'EUR', 'USA', 'JPN', 'KOR', 'ASIA', 'WORLD', edition.region, values.region])].filter(Boolean), [edition.region, values.region]);
  const update = <K extends keyof CopyEditorValues>(field: K, value: CopyEditorValues[K]) => {
    setSession(previous => previous ? {...previous, draft: {...previous.draft, [field]: value}} : previous);
    setError(''); setNotice('');
  };
  const clearEditingParam = useCallback(() => setSearch(previous => {const next = new URLSearchParams(previous); next.delete('edit'); return next;}, {replace: true}), [setSearch]);
  const endEditing = useCallback((target: string | null = null) => {
    setSession(null); setPending(null); setError('');
    if (target) navigate(target); else clearEditingParam();
  }, [navigate, clearEditingParam]);
  const requestExit = useCallback((target: string | null) => {
    if (busy) return;
    if (dirty) setPending({target}); else endEditing(target);
  }, [busy, dirty, endEditing]);

  useEffect(() => {
    if (!dirty && !busy) return;
    const unload = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    // Links in the surrounding shell must not discard an in-progress edit either.
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      const hash = anchor?.getAttribute('href');
      if (!hash?.startsWith('#/') || anchor?.target === '_blank') return;
      event.preventDefault(); event.stopPropagation(); requestExit(hash.slice(1));
    };
    window.addEventListener('beforeunload', unload); document.addEventListener('click', click, true);
    return () => {window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true);};
  }, [dirty, busy, requestExit]);

  async function save(target: string | null = null) {
    if (!session || busy) return;
    setError('');
    let details;
    try {details = copyEditorDetails(session.initial, session.draft);}
    catch (cause) {setPending(null); setError(cause instanceof Error ? cause.message : 'Проверьте реквизиты.'); return;}
    setSaving(true);
    try {
      if (await updateEdition(edition.id, details)) {endEditing(target); setNotice('Изменения сохранены.');}
      else setPending(null);
    } finally {setSaving(false);}
  }
  const gameUrl = `/games?game=${encodeURIComponent(game.id)}&editionId=${encodeURIComponent(edition.id)}`;
  const composeUrl = (kind: 'listing' | 'auction') => `${kind === 'auction' ? '/auctions' : '/listings/sales'}?compose=1&game=${encodeURIComponent(game.id)}&editionId=${encodeURIComponent(edition.id)}`;
  const condition = formatMarketCondition(copy.condition);
  return <ModalShell isOpen onClose={() => requestExit('/collection')} labelledBy="copy-detail-title" contentClassName="copy-detail-modal">
    <form className={`copy-detail${editing ? ' is-editing' : ''}`} onSubmit={event => {event.preventDefault(); void save();}}>
      <header className="copy-detail__header">
        <div><div className="modal-header-meta"><span className="copy-detail__eyebrow"><span className="eyebrow-dot" />ЭКЗЕМПЛЯР</span><span className="meta-chip">Моя коллекция</span></div><h2 className="modal-title" id="copy-detail-title">{game.title}</h2></div>
        <div className="copy-detail__header-actions"><button type="button" className="btn-secondary copy-detail__edit" aria-pressed={editing} disabled={busy} onClick={() => {
          if (editing) requestExit(null);
          else {setSession({initial: current, draft: {...current, photos: [...current.photos]}}); setNotice(''); setError('');}
        }}><Pencil size={17} />Редактировать</button><IconButton label="Закрыть экземпляр" transparent disabled={busy} onClick={() => requestExit('/collection')}><X size={20} /></IconButton></div>
      </header>
      <div className="copy-detail__overview">
        <CopyPhotoGallery photos={values.photos} title={game.title} caption={`${edition.name} · ${edition.platform}`} editing={editing} disabled={saving} onBusyChange={setProcessingPhotos} onChange={next => update('photos', next)} />
        <div className="copy-detail__specs">
          <dl className="copy-detail__facts">
            <div><dt>Платформа</dt><dd><PlatformBadge platform={edition.platform} /></dd></div>
            <div><dt>Издание</dt><dd>{edition.name}</dd></div>
            <div><dt>{editing ? <label htmlFor="copy-region">Регион</label> : 'Регион'}</dt><dd>{editing ? <select id="copy-region" className="form-control" value={values.region} disabled={saving} onChange={event => update('region', event.target.value)}><option value="">Не указан</option>{regions.map(region => <option key={region}>{region}</option>)}</select> : (copy.region ?? edition.region) || 'Не указан'}</dd></div>
            <div><dt>{editing ? <label htmlFor="copy-condition">Состояние</label> : 'Состояние'}</dt><dd>{editing ? <input id="copy-condition" className="form-control" value={values.condition} maxLength={60} placeholder="Например, 9/10" disabled={saving} onChange={event => update('condition', event.target.value)} /> : <span className="copy-detail__condition">{condition || 'Не указано'}</span>}</dd></div>
            <div><dt>{editing ? <label htmlFor="copy-completeness">Комплектность</label> : 'Комплектность'}</dt><dd>{editing ? <fieldset disabled={saving} className="copy-detail__inline-fieldset"><CompletenessCombobox id="copy-completeness" value={values.completeness} onChange={next => update('completeness', next)} /></fieldset> : completenessLabel(copy.completeness) || 'Не указана'}</dd></div>
            <div><dt>{editing ? <label htmlFor="copy-date">Дата покупки</label> : 'Дата покупки'}</dt><dd>{editing ? <input id="copy-date" type="date" className="form-control" disabled={saving} value={values.purchaseDate} onChange={event => update('purchaseDate', event.target.value)} /> : formatPurchaseDate(copy.purchaseDate) || 'Не указана'}</dd></div>
            <div><dt>{editing ? <label htmlFor="copy-price">Цена покупки</label> : 'Цена покупки'}</dt><dd>{editing ? <fieldset disabled={saving} className="copy-detail__inline-fieldset"><MoneyInput id="copy-price" value={values.purchasePrice} onChange={next => update('purchasePrice', next)} /></fieldset> : <span className="copy-detail__price">{copy.purchasePrice === null ? 'Не указана' : `${formatMoneyInput(String(copy.purchasePrice))} ₽`}</span>}</dd></div>
          </dl>
          <section className="copy-detail__contents"><h3>Состав комплекта</h3><div>{edition.contents.length ? edition.contents.map((item, index) => <span key={`${index}:${item}`}>{item}</span>) : <span>Комплект не указан</span>}</div></section>
          <QuantityControl quantity={values.quantity} disabled={busy} onChange={quantity => {
            if (editing) update('quantity', quantity);
            else {setSession({initial: current, draft: {...current, quantity}}); setNotice('');}
          }} />
          {editing && group.length > 1 && <p className="copy-detail__hint">Реквизиты и фотографии применятся ко всем экземплярам этого издания.</p>}
        </div>
      </div>
      <div className="copy-detail__actions"><button type="button" className="btn-primary" disabled={busy} onClick={() => requestExit(gameUrl)}><ExternalLink size={17} />Открыть игру</button><GameActions onPlaceListing={() => requestExit(composeUrl('listing'))} onPlaceAuction={() => requestExit(composeUrl('auction'))} /></div>
      <section className="copy-detail__notes"><h3>{editing ? <label htmlFor="copy-notes">Заметки</label> : 'Заметки'}</h3>{editing ? <textarea id="copy-notes" className="form-control" rows={3} maxLength={2000} disabled={saving} value={values.notes} onChange={event => update('notes', event.target.value)} /> : <p>{copy.notes || 'Заметки пока не добавлены.'}</p>}</section>
      {(error || syncError) && <p className="market-form__error" role="alert">{error || syncError}</p>}
      {notice && <p role="status">{notice}</p>}
      {editing && <div className="copy-detail__save"><button type="button" className="btn-secondary" disabled={busy} onClick={() => requestExit(null)}>Отмена</button><button className="btn-primary" type="submit" disabled={busy}>{saving ? 'Сохраняем…' : processingPhotos ? 'Обработка фото…' : 'Сохранить'}</button></div>}
    </form>
    {pending && <UnsavedChangesDialog busy={busy} onContinue={() => setPending(null)} onDiscard={() => endEditing(pending.target)} onSave={() => void save(pending.target)} />}
  </ModalShell>;
}
