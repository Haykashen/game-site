import { RefreshCw, Star, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { PublicProfile, ReviewDto } from '@discvault/shared';
import {
  errorMessage,
  fetchPublicProfile,
  listUserReviews,
  listMarketEntries,
  mapMarketEntry,
} from '../api';
import { INITIAL_MARKET_ENTRIES } from '../data';
import { getDemoProfile } from '../lib/publicProfiles';
import { useCollection } from '../context/CollectionContext';
import type { MarketEntry } from '../types';
import { MarketCard } from '../components/market/MarketCard';
import { ProfileLink } from '../components/ProfileLink';
import { PageHeading } from '../components/PageHeading';
import { ReportSection } from '../components/reports/ReportSection';
import { SpecRow } from '../components/ui/SpecRow';
import { useAuth } from '../context/AuthContext';

function formatMemberSince(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatReviewDate(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Public collector profile with reviews and a report action. */
export function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  return <PublicProfileContent key={id} id={id} />;
}

function PublicProfileContent({ id }: { id: string | undefined }) {
  const { user } = useAuth();
  const { games, getEdition } = useCollection();
  const navigate = useNavigate();
  const requestId = useRef(0);
  const [entries, setEntries] = useState<MarketEntry[]>([]);
  const [marketPage, setMarketPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [marketTotal, setMarketTotal] = useState(0);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!id) {
      setError('Пользователь не найден.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const demoProfile = getDemoProfile(id);
      if (demoProfile) {
        const demoEntries = INITIAL_MARKET_ENTRIES.filter((entry) => entry.seller === demoProfile.displayName && entry.status === 'active');
        setProfile(demoProfile);
        setReviews([]);
        setReviewTotal(0);
        setEntries(demoEntries.slice((marketPage - 1) * 12, marketPage * 12));
        setMarketTotal(demoEntries.length);
        return;
      }
      const [nextProfile, nextReviews, market] = await Promise.all([
        fetchPublicProfile(id),
        listUserReviews(id, { page: reviewPage, pageSize: 12 }),
        listMarketEntries({ authorId: id, status: 'active', page: marketPage, pageSize: 12 }),
      ]);
      if (requestId.current !== currentRequest) return;
      setProfile(nextProfile);
      setReviews(nextReviews.items);
      setReviewTotal(nextReviews.total);
      setEntries(market.items.map(mapMarketEntry));
      setMarketTotal(market.total);
    } catch (loadError) {
      if (requestId.current !== currentRequest) return;
      setProfile(null);
      setReviews([]);
      setError(errorMessage(loadError));
    } finally {
      if (requestId.current === currentRequest) setIsLoading(false);
    }
  }, [id, marketPage, reviewPage]);

  useEffect(() => {
    void loadProfile();
    return () => { requestId.current += 1; };
  }, [loadProfile]);

  const isOwnProfile = Boolean(profile && user?.id === profile.id);

  return (
    <>
      <PageHeading
        eyebrow="COLLECTOR / PROFILE"
        title={profile?.displayName ?? 'Профиль коллекционера'}
        description="Публичный профиль, рейтинг и отзывы после завершённых сделок."
      />

      {isLoading && (
        <div className="panel account-notice">
          <div>
            <strong>Загружаем профиль</strong>
            <p>Получаем данные коллекционера и отзывы.</p>
          </div>
        </div>
      )}

      {!isLoading && error && (
        <div className="panel account-notice">
          <div>
            <strong>Профиль недоступен</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => void loadProfile()}>
            <RefreshCw size={15} aria-hidden="true" />
            Повторить
          </button>
        </div>
      )}

      {!isLoading && profile && (
        <>
          <div className="panel profile-panel">
            <div className="profile-head">
              {profile.avatarUrl ? (
                <img className="profile-avatar" src={profile.avatarUrl} alt="" />
              ) : (
                <div className="profile-avatar">
                  <UserRound size={28} aria-hidden="true" />
                </div>
              )}
              <div className="profile-meta">
                <p className="profile-name">{profile.displayName}</p>
                <p className="profile-sub">
                  {profile.city ?? 'Город не указан'} · {profile.memberSince ? `на сайте с ${formatMemberSince(profile.memberSince)}` : 'Демонстрационный профиль'}
                </p>
              </div>
              <span className="profile-rating">
                <Star size={14} aria-hidden="true" />
                {profile.rating === null
                  ? 'Нет рейтинга'
                  : `${profile.rating.toFixed(1)} · ${profile.reviewCount}`}
              </span>
            </div>

            <div className="profile-columns">
              <div className="spec-box">
                <h4>Профиль</h4>
                <SpecRow label="Имя" value={profile.displayName} />
                <SpecRow label="Город" value={profile.city ?? '—'} />
                <SpecRow label="На сайте с" value={formatMemberSince(profile.memberSince)} />
              </div>
              <div className="spec-box">
                <h4>Статистика</h4>
                <SpecRow
                  label="Рейтинг"
                  value={
                    profile.rating === null
                      ? '—'
                      : `${profile.rating.toFixed(1)}/5`
                  }
                />
                <SpecRow label="Отзывы" value={String(profile.reviewCount)} />
                <SpecRow label="Сделки" value={String(profile.dealsCompleted)} />
              </div>
            </div>
            {isOwnProfile && <Link className="btn-secondary" to="/account">Редактировать профиль</Link>}
          </div>

          {getDemoProfile(profile.id) && (
            <p className="panel-hint">Демонстрационный профиль. Рейтинг и отзывы доступны для пользователей в сетевом режиме.</p>
          )}

          <section className="panel account-deals-panel" aria-label="Объявления пользователя">
            <div className="account-deals-panel__head">
              <h3 className="panel-title">Активные объявления и аукционы · {marketTotal}</h3>
            </div>
            {entries.length === 0 ? <p className="panel-hint">Активных объявлений пока нет.</p> : (
              <div className="market-grid">
                {entries.map((entry) => (
                  <MarketCard key={entry.id} entry={entry}
                    game={games.find((game) => game.id === entry.gameId)}
                    edition={entry.editionId ? getEdition(entry.editionId) : undefined}
                    isOwn={isOwnProfile}
                    onSelect={() => navigate(`${entry.kind === 'auction' ? '/auctions' : '/listings'}?item=${encodeURIComponent(entry.id)}`)} />
                ))}
              </div>
            )}
            {marketTotal > 12 && <ProfilePagination page={marketPage} total={marketTotal} onChange={setMarketPage} label="Объявления" />}
          </section>

          <ReportSection
            key={profile.id}
            targetType="user"
            targetId={profile.id}
            targetLabel={profile.displayName}
            disabled={isOwnProfile || Boolean(getDemoProfile(profile.id))}
          />

          <div className="panel account-deals-panel">
            <div className="account-deals-panel__head">
              <div>
                <h3 className="panel-title">Отзывы · {reviewTotal}</h3>
                <p className="panel-hint">
                  Отзывы появляются после завершённых сделок.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void loadProfile()}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Обновить
              </button>
            </div>

            {reviews.length === 0 ? (
              <p className="panel-hint">Отзывов пока нет.</p>
            ) : (
              <div className="account-deals">
                {reviews.map((review) => (
                  <article className="deal-row" key={review.id}>
                    <div className="deal-row__head">
                      <div>
                        <p className="deal-row__title">
                          <Star size={13} aria-hidden="true" /> {review.rating}/5
                        </p>
                        <p className="deal-row__meta">
                          <ProfileLink name={review.author.displayName} userId={review.author.id} /> · {formatReviewDate(review.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="user-review__text">
                      {review.text || 'Без комментария'}
                    </p>
                  </article>
                ))}
              </div>
            )}
            {reviewTotal > 12 && <ProfilePagination page={reviewPage} total={reviewTotal} onChange={setReviewPage} label="Отзывы" />}
          </div>
        </>
      )}
    </>
  );
}

function ProfilePagination({ page, total, onChange, label }: {
  page: number; total: number; onChange: (page: number) => void; label: string;
}) {
  return <nav className="profile-actions" aria-label={`${label}: страницы`}>
    <button className="btn-secondary" disabled={page === 1} onClick={() => onChange(page - 1)}>Назад</button>
    <span className="panel-hint">{page} / {Math.ceil(total / 12)}</span>
    <button className="btn-secondary" disabled={page * 12 >= total} onClick={() => onChange(page + 1)}>Далее</button>
  </nav>;
}
