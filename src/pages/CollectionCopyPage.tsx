import { ArrowLeft, ExternalLink, Minus, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { ApiState } from '../components/ApiState';
import { CopyEditForm } from '../components/collection/CopyEditForm';
import { MarketPhotoGallery } from '../components/market/MarketPhotoGallery';
import { PlatformBadge } from '../components/ui/PlatformBadge';
import { useCollection } from '../context/CollectionContext';
import { completenessLabel, formatPurchaseDate } from '../lib/collection';
import { editionContentsLabel, editionLabel } from '../lib/editions';
import { formatMarketCondition } from '../lib/market';
import { formatPrice } from '../lib/formatPrice';
import { MAX_COLLECTION_QUANTITY } from '../lib/constants';

/** The collection route uses the same edition group as the shelf card. */
export function CollectionCopyPage() {
  const { editionId } = useParams();
  const [search, setSearch] = useSearchParams();
  const { copies, editionById, games, updateEdition, setEditionQuantity, isSyncing, isCatalogLoading, syncError, catalogError, refresh } = useCollection();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const group = copies.filter(copy => copy.editionId === editionId).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const copy = group[0];
  const edition = editionById.get(editionId ?? '');
  const game = games.find(item => item.id === edition?.gameId);
  const editing = search.get('edit') === '1';
  const error = syncError ?? catalogError;
  const closeEditor = () => setSearch({}, {replace: true});
  const changeQuantity = async (next: number) => {
    if (saving || !editionId) return;
    setSaving(true);
    try {await setEditionQuantity(editionId, next);} finally {setSaving(false);}
  };
  if (!copy || !edition || !game) return <>
    <Link to="/collection" className="btn-secondary"><ArrowLeft size={16} />В коллекцию</Link>
    <ApiState loading={isSyncing || isCatalogLoading} error={error} onRetry={refresh} />
    {!isSyncing && !isCatalogLoading && !error && <div className="panel account-notice">Экземпляр не найден в вашей коллекции.</div>}
  </>;
  const photos = [...new Set(group.flatMap(item => item.photos).filter(Boolean))];
  return <article className="collection-detail">
    <Link to="/collection" className="collection-detail__back"><ArrowLeft size={16} />Моя коллекция</Link>
    <PageHeading eyebrow="MY SHELF / COPY" title={game.title} description={editionLabel(edition)} />
    {error && <ApiState loading={false} error={error} onRetry={refresh} />}
    <div className="collection-detail__overview">
      <MarketPhotoGallery photos={photos} title={game.title} expandable />
      <section className="panel collection-detail__specs" aria-label="Реквизиты экземпляра">
        <div className="collection-detail__toolbar"><PlatformBadge platform={edition.platform} /><span className="meta-chip">В коллекции × {group.length}</span></div>
        <dl className="game-detail__facts">
          <div><dt>Издание</dt><dd>{edition.name}</dd></div>
          <div><dt>Регион</dt><dd>{edition.region || 'Не указан'}</dd></div>
          <div><dt>Состояние</dt><dd>{formatMarketCondition(copy.condition) || 'Не указано'}</dd></div>
          <div><dt>Комплектность</dt><dd>{completenessLabel(copy.completeness) || 'Не указана'}</dd></div>
          <div><dt>Цена покупки</dt><dd>{copy.purchasePrice === null ? 'Не указана' : formatPrice(copy.purchasePrice)}</dd></div>
          <div><dt>Дата покупки</dt><dd>{formatPurchaseDate(copy.purchaseDate) || 'Не указана'}</dd></div>
          <div><dt>Добавлено в коллекцию</dt><dd>{Number.isNaN(Date.parse(copy.createdAt)) ? '—' : new Date(copy.createdAt).toLocaleString('ru-RU')}</dd></div>
          <div><dt>Состав издания</dt><dd>{editionContentsLabel(edition)}</dd></div>
        </dl>
        <div className="collection-detail__toolbar">
          <span>Количество</span>
          <button type="button" className="btn-secondary" aria-label="Уменьшить количество" disabled={group.length <= 1 || saving} onClick={() => void changeQuantity(group.length - 1)}><Minus size={16} /></button>
          <span aria-live="polite">{group.length}</span>
          <button type="button" className="btn-secondary" aria-label="Увеличить количество" disabled={group.length >= MAX_COLLECTION_QUANTITY || saving} onClick={() => void changeQuantity(group.length + 1)}><Plus size={16} /></button>
        </div>
        <div className="collection-detail__toolbar">
          {!editing && <button type="button" className="btn-primary" onClick={() => {setSaved(false); setSearch({edit: '1'}, {replace: true});}}><Pencil size={16} />Редактировать</button>}
          <Link className="btn-secondary" to={`/games?game=${encodeURIComponent(game.id)}&editionId=${encodeURIComponent(edition.id)}`}><ExternalLink size={16} />Открыть игру</Link>
        </div>
      </section>
    </div>
    {saved && <p role="status">Изменения сохранены.</p>}
    {editing ? <section className="panel collection-detail__editor" aria-labelledby="copy-editor-title">
      <h2 id="copy-editor-title">Редактировать экземпляр</h2>
      <CopyEditForm key={copy.id} copy={copy} edition={edition} game={game} quantity={group.length} titleId="copy-editor-title" showHeader={false} isSaving={saving}
        onCancel={() => {if (!saving) closeEditor();}}
        onSubmit={async details => {
          if (saving) return;
          setSaving(true);
          try { if (await updateEdition(edition.id, details)) {closeEditor(); setSaved(true);} }
          finally {setSaving(false);}
        }} />
    </section> : <section className="panel collection-detail__notes"><h2>Заметки</h2><p>{copy.notes || 'Заметки пока не добавлены.'}</p></section>}
  </article>;
}
