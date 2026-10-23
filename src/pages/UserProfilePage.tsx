import { RefreshCw, Star, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { PublicProfile, ReviewDto } from '@retrokeep/shared';
import {
  errorMessage,
  fetchPublicProfile,
  listUserReviews,
} from '../api';
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
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    if (!id) {
      setError('Пользователь не найден.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const [nextProfile, reviewPage] = await Promise.all([
        fetchPublicProfile(id),
        listUserReviews(id, { page: 1, pageSize: 50 }),
      ]);
      setProfile(nextProfile);
      setReviews(reviewPage.items);
    } catch (loadError) {
      setProfile(null);
      setReviews([]);
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProfile();
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
                  {profile.city ?? 'Город не указан'} · на сайте с{' '}
                  {formatMemberSince(profile.memberSince)}
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
          </div>

          <ReportSection
            key={profile.id}
            targetType="user"
            targetId={profile.id}
            targetLabel={profile.displayName}
            disabled={isOwnProfile}
          />

          <div className="panel account-deals-panel">
            <div className="account-deals-panel__head">
              <div>
                <h3 className="panel-title">Отзывы</h3>
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
                          {review.author.displayName} · {formatReviewDate(review.createdAt)}
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
          </div>
        </>
      )}
    </>
  );
}
