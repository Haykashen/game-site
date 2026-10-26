import {
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Gavel,
  RefreshCw,
  ShieldCheck,
  Tag,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  marketItemLabel,
  type AdminMarketEntryDto,
  type MarketModerationStatus,
} from '@discvault/shared';
import {
  errorMessage,
  listAdminMarketEntries,
  updateMarketModeration,
} from '../api';
import { PageHeading } from '../components/PageHeading';
import { useAuth } from '../context/AuthContext';
import { useCollection } from '../context/CollectionContext';
import { formatPrice } from '../lib/formatPrice';
import {
  bidsLabel,
  formatMarketDate,
  formatMarketDateTime,
  isAuctionOver,
  listingTypeLabel,
} from '../lib/market';

type StatusFilter = 'all' | MarketModerationStatus;
type KindFilter = 'all' | 'listing' | 'auction';

const STATUS_LABELS: Record<MarketModerationStatus, string> = {
  pending: 'На проверке',
  visible: 'Опубликован',
  hidden: 'Отклонён',
  removed: 'Снят',
};

/** Moderation queue for new lots and listings. */
export function AdminMarketPage() {
  const { user, isModerator, status: apiStatus } = useAuth();
  const { games, editions } = useCollection();
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [kind, setKind] = useState<KindFilter>('all');
  const [entries, setEntries] = useState<AdminMarketEntryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const gamesById = new Map(games.map((game) => [game.id, game]));
  const editionsById = new Map(editions.map((edition) => [edition.id, edition]));

  const loadEntries = useCallback(async () => {
    if (!isModerator) {
      setEntries([]);
      setTotal(0);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const page = await listAdminMarketEntries({
        status,
        pageSize: 100,
        ...(kind !== 'all' ? { kind } : {}),
      });
      setEntries(page.items);
      setTotal(page.total);
    } catch (loadError) {
      setEntries([]);
      setTotal(0);
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [isModerator, status, kind]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleModeration = async (
    entry: AdminMarketEntryDto,
    moderationStatus: 'visible' | 'hidden',
  ) => {
    if (
      moderationStatus === 'hidden' &&
      !window.confirm(
        entry.moderationStatus === 'pending'
          ? 'Отклонить лот и не публиковать его на маркете?'
          : 'Скрыть опубликованный лот с маркета?',
      )
    ) {
      return;
    }

    setBusyId(entry.id);
    setActionError('');

    try {
      await updateMarketModeration(entry.id, {
        moderationStatus,
        note: notes[entry.id]?.trim() || null,
      });
      setNotes((previous) => {
        const next = { ...previous };
        delete next[entry.id];
        return next;
      });
      await loadEntries();
    } catch (actionFailure) {
      setActionError(errorMessage(actionFailure));
    } finally {
      setBusyId(null);
    }
  };

  if (!isModerator && apiStatus === 'checking') {
    return (
      <>
        <PageHeading
          eyebrow="ADMIN / MODERATION"
          title="Модерация"
          description="Проверяем доступ к разделу модерации."
        />
        <div className="panel account-notice">
          <div>
            <strong>Проверяем доступ</strong>
            <p>Загружаем данные аккаунта.</p>
          </div>
        </div>
      </>
    );
  }

  if (!isModerator) {
    const isOffline = apiStatus === 'offline';

    return (
      <>
        <PageHeading
          eyebrow="ADMIN / MODERATION"
          title="Модерация"
          description={
            isOffline
              ? 'Модерация новых лотов доступна в сетевом режиме, когда подключены API и база данных.'
              : 'Раздел доступен администраторам и модераторам.'
          }
        />
        <div className="panel account-notice">
          <div>
            <strong>
              {isOffline ? 'Нет подключения к API' : 'Недостаточно прав'}
            </strong>
            <p>
              {isOffline
                ? 'В автономном режиме лоты не отправляются на проверку. Запустите API с PostgreSQL, чтобы открыть очередь публикации.'
                : user
                  ? 'Этот аккаунт не имеет доступа к проверке лотов.'
                  : 'Войдите в аккаунт администратора или модератора.'}
            </p>
          </div>
          {!user && !isOffline && (
            <Link className="btn-secondary" to="/account">
              <ShieldCheck size={15} aria-hidden="true" />
              Войти
            </Link>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="ADMIN / MODERATION"
        title="Модерация"
        description="Новые объявления и аукционы попадают сюда до публикации. Одобрите лот или отклоните его с комментарием для автора."
        action={
          <button
            type="button"
            className="btn-secondary"
            disabled={isLoading}
            onClick={() => void loadEntries()}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {isLoading ? 'Обновляем…' : 'Обновить'}
          </button>
        }
      />

      <div className="admin-reports__filters panel">
        <label>
          <span className="form-label">Статус</span>
          <select
            className="form-control"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            <option value="pending">На проверке</option>
            <option value="visible">Опубликованные</option>
            <option value="hidden">Отклонённые</option>
            <option value="removed">Снятые</option>
            <option value="all">Все</option>
          </select>
        </label>

        <label>
          <span className="form-label">Тип лота</span>
          <select
            className="form-control"
            value={kind}
            onChange={(event) => setKind(event.target.value as KindFilter)}
          >
            <option value="all">Все</option>
            <option value="listing">Объявления</option>
            <option value="auction">Аукционы</option>
          </select>
        </label>

        <span className="admin-reports__count">
          {isLoading ? 'Загружаем…' : `Найдено: ${total}`}
        </span>
      </div>

      {error && (
        <p className="market-form__error" role="alert">
          {error}
        </p>
      )}
      {actionError && (
        <p className="market-form__error" role="alert">
          {actionError}
        </p>
      )}

      {isLoading && entries.length === 0 ? (
        <div className="panel account-notice">
          <div>
            <strong>Загружаем лоты</strong>
            <p>Получаем очередь проверки.</p>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="panel account-notice">
          <div>
            <strong>
              {status === 'pending' ? 'Очередь пуста' : 'Лотов нет'}
            </strong>
            <p>
              {status === 'pending'
                ? 'Все новые лоты проверены. Здесь появятся следующие объявления и аукционы.'
                : 'В выбранном фильтре пока нет лотов.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="admin-reports">
          {entries.map((entry) => {
            const isBusy = busyId === entry.id;
            const game = gamesById.get(entry.gameId);
            const edition = entry.editionId
              ? editionsById.get(entry.editionId)
              : undefined;
            const KindIcon = entry.kind === 'auction' ? Gavel : Tag;
            const kindLabel =
              entry.kind === 'auction'
                ? 'Аукцион'
                : listingTypeLabel(entry.listingType);
            const auctionExpired =
              entry.kind === 'auction' && isAuctionOver(entry.endsAt);

            return (
              <article
                className="admin-report admin-report--market"
                key={entry.id}
              >
                <div className="admin-report__head">
                  <div>
                    <p className="admin-report__reason">
                      <KindIcon size={14} aria-hidden="true" />
                      {kindLabel}: {entry.title}
                    </p>
                    <p className="admin-report__date">
                      Создан {formatMarketDate(entry.createdAt)} ·{' '}
                      {marketItemLabel(entry.itemType)}
                    </p>
                  </div>
                  <span
                    className={`admin-report__status admin-report__status--${entry.moderationStatus}`}
                  >
                    {STATUS_LABELS[entry.moderationStatus]}
                  </span>
                </div>

                <div className="admin-report__target">
                  <span className="admin-report__label">Игра</span>
                  <span>{game?.title ?? entry.gameId}</span>
                  {edition && (
                    <span className="admin-report__muted">
                      {edition.platform} · {edition.region} · {edition.name}
                    </span>
                  )}
                  <span className="admin-report__muted">
                    Автор:{' '}
                    <Link to={`/users/${entry.authorId}`}>
                      {entry.author.displayName}
                    </Link>
                  </span>
                </div>

                <div className="admin-report__meta">
                  <span>Цена: {formatPrice(entry.price)}</span>
                  <span>Состояние: {entry.condition}</span>
                  <span>Отправка: {entry.shipsFrom}</span>
                  {entry.kind === 'auction' && (
                    <span>
                      Торги: {formatMarketDateTime(entry.startsAt)} —{' '}
                      {formatMarketDateTime(entry.endsAt)}
                      {auctionExpired ? ' · уже завершились' : ''}
                    </span>
                  )}
                  <span>{bidsLabel(entry.bids)}</span>
                </div>

                {entry.photos.length > 0 && (
                  <div className="admin-market__photos">
                    {entry.photos.slice(0, 4).map((photo, index) => (
                      <img
                        key={`${entry.id}-photo-${index}`}
                        src={photo}
                        alt={`Фото лота ${index + 1}`}
                        loading="lazy"
                      />
                    ))}
                    {entry.photos.length > 4 && (
                      <span className="admin-market__photo-more">
                        +{entry.photos.length - 4}
                      </span>
                    )}
                  </div>
                )}

                <p className="admin-report__comment">{entry.description}</p>

                {entry.moderationNote && (
                  <p className="admin-report__note">
                    Комментарий модератора: {entry.moderationNote}
                  </p>
                )}

                {entry.moderator && (
                  <div className="admin-report__meta">
                    <span>
                      Проверил: {entry.moderator.displayName}
                      {entry.moderatedAt
                        ? ` · ${formatMarketDateTime(entry.moderatedAt)}`
                        : ''}
                    </span>
                  </div>
                )}

                <label className="admin-report__note-field">
                  <span className="form-label">
                    Комментарий для автора
                  </span>
                  <textarea
                    className="form-control"
                    rows={2}
                    maxLength={2000}
                    placeholder="Необязательно. При отклонении автор увидит причину в уведомлении."
                    value={notes[entry.id] ?? ''}
                    onChange={(event) =>
                      setNotes((previous) => ({
                        ...previous,
                        [entry.id]: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="admin-report__actions">
                  {entry.moderationStatus !== 'visible' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={isBusy || auctionExpired}
                      onClick={() => void handleModeration(entry, 'visible')}
                    >
                      <CheckCircle2 size={15} aria-hidden="true" />
                      {entry.moderationStatus === 'pending'
                        ? 'Одобрить и опубликовать'
                        : 'Опубликовать'}
                    </button>
                  )}

                  {entry.moderationStatus !== 'hidden' &&
                    entry.moderationStatus !== 'removed' && (
                      <button
                        type="button"
                        className="btn-secondary admin-report__danger"
                        disabled={isBusy}
                        onClick={() => void handleModeration(entry, 'hidden')}
                      >
                        <XCircle size={15} aria-hidden="true" />
                        {entry.moderationStatus === 'pending'
                          ? 'Отклонить'
                          : 'Скрыть'}
                      </button>
                    )}

                  {entry.moderationStatus === 'visible' && (
                    <Link
                      className="btn-secondary"
                      to={`/${entry.kind === 'auction' ? 'auctions' : 'listings'}?item=${encodeURIComponent(entry.id)}`}
                    >
                      <Eye size={15} aria-hidden="true" />
                      Открыть на маркете
                    </Link>
                  )}

                  {entry.moderationStatus === 'hidden' && (
                    <span className="admin-report__muted admin-market__hint">
                      <EyeOff size={14} aria-hidden="true" />
                      Лот скрыт из общей ленты и недоступен другим
                      пользователям.
                    </span>
                  )}

                  {entry.moderationStatus === 'pending' && (
                    <span className="admin-report__muted admin-market__hint">
                      <Clock3 size={14} aria-hidden="true" />
                      Лот не виден другим пользователям до одобрения.
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
