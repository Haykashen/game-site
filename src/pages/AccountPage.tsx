import {
  CheckCircle2,
  LogIn,
  LogOut,
  RefreshCw,
  Star,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ProfileLink } from '../components/ProfileLink';
import type { DealDto } from '@discvault/shared';
import {
  createReview,
  errorMessage,
  listDeals,
  updateDealStatus,
} from '../api';
import { PageHeading } from '../components/PageHeading';
import { FormField } from '../components/ui/FormField';
import { SpecRow } from '../components/ui/SpecRow';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../lib/formatPrice';

type AuthMode = 'login' | 'register';

function formatMemberSince(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function dealStatusLabel(status: DealDto['status']): string {
  if (status === 'completed') return 'Завершена';
  if (status === 'cancelled') return 'Отменена';
  return 'В процессе';
}

interface DealRowProps {
  deal: DealDto;
  currentUserId: string;
  onRefresh: () => Promise<void>;
}

function DealRow({ deal, currentUserId, onRefresh }: DealRowProps) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [rating, setRating] = useState('5');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const isBuyer = deal.buyer.id === currentUserId;

  const handleComplete = async () => {
    setIsBusy(true);
    setError('');

    try {
      await updateDealStatus(deal.id, 'completed');
      await onRefresh();
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setIsBusy(false);
    }
  };

  const handleReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBusy(true);
    setError('');

    try {
      await createReview(deal.id, {
        rating: Number(rating),
        text: text.trim(),
      });
      setIsReviewing(false);
      setText('');
      await onRefresh();
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <article className="deal-row">
      <div className="deal-row__head">
        <div>
          <p className="deal-row__title">{deal.entry.title}</p>
          <p className="deal-row__meta">
            {isBuyer ? 'Покупка' : 'Продажа'} · {formatPrice(deal.amount)} ·{' '}
            <ProfileLink name={isBuyer ? deal.seller.displayName : deal.buyer.displayName} userId={isBuyer ? deal.seller.id : deal.buyer.id} />
          </p>
        </div>
        <span
          className={`meta-chip deal-row__status deal-row__status--${deal.status}`}
        >
          {dealStatusLabel(deal.status)}
        </span>
      </div>

      {deal.reviews.length > 0 && (
        <div className="deal-row__reviews">
          {deal.reviews.map((review) => (
            <p className="deal-review" key={review.id}>
              <Star size={12} aria-hidden="true" /> {review.rating}/5 ·{' '}
              {review.text || 'Без комментария'}
            </p>
          ))}
        </div>
      )}

      {(deal.canComplete || deal.canReview) && (
        <div className="deal-row__actions">
          {deal.canComplete && (
            <button
              type="button"
              className="market-form__submit"
              disabled={isBusy}
              onClick={() => void handleComplete()}
            >
              <CheckCircle2 size={15} aria-hidden="true" />
              Завершить сделку
            </button>
          )}
          {deal.canReview && (
            <button
              type="button"
              className="btn-secondary"
              disabled={isBusy}
              onClick={() => setIsReviewing((value) => !value)}
            >
              <Star size={15} aria-hidden="true" />
              {isReviewing ? 'Скрыть отзыв' : 'Оставить отзыв'}
            </button>
          )}
        </div>
      )}

      {isReviewing && (
        <form className="deal-row__review-form" onSubmit={handleReview}>
          <FormField id={`dealRating-${deal.id}`} label="Оценка">
            <select
              id={`dealRating-${deal.id}`}
              className="form-control"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
            >
              <option value="5">5 — отлично</option>
              <option value="4">4 — хорошо</option>
              <option value="3">3 — нормально</option>
              <option value="2">2 — плохо</option>
              <option value="1">1 — очень плохо</option>
            </select>
          </FormField>
          <FormField id={`dealText-${deal.id}`} label="Комментарий">
            <textarea
              id={`dealText-${deal.id}`}
              className="form-control"
              rows={3}
              maxLength={1000}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </FormField>
          <button type="submit" className="market-form__submit" disabled={isBusy}>
            Отправить отзыв
          </button>
        </form>
      )}

      {error && (
        <p className="market-form__error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

/** Account, API session and deal history. */
export function AccountPage() {
  const {
    status,
    user,
    login,
    register,
    logout,
    updateProfile,
    refresh,
  } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [deals, setDeals] = useState<DealDto[]>([]);
  const [dealsError, setDealsError] = useState('');
  const [isLoadingDeals, setIsLoadingDeals] = useState(false);

  useEffect(() => {
    if (!user) {
      setDeals([]);
      return;
    }

    setProfileName(user.displayName);
    setProfilePhone(user.phone ?? '');
    setProfileCity(user.city ?? '');
  }, [user]);

  const loadDeals = useCallback(async () => {
    if (!user) {
      setDeals([]);
      return;
    }

    setIsLoadingDeals(true);
    setDealsError('');

    try {
      const page = await listDeals({ role: 'all', status: 'all', pageSize: 50 });
      setDeals(page.items);
    } catch (loadError) {
      setDealsError(errorMessage(loadError));
    } finally {
      setIsLoadingDeals(false);
    }
  }, [user]);

  useEffect(() => {
    void loadDeals();
  }, [loadDeals]);

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);

    try {
      if (authMode === 'login') {
        await login({ email: email.trim(), password });
      } else {
        await register({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        });
      }

      setPassword('');
    } catch (authFailure) {
      setAuthError(errorMessage(authFailure));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    setProfileError('');
    setProfileMessage('');
    setIsSavingProfile(true);

    try {
      await updateProfile({
        displayName: profileName.trim(),
        phone: profilePhone.trim() || null,
        city: profileCity.trim() || null,
      });
      setProfileMessage('Профиль сохранён.');
    } catch (profileFailure) {
      setProfileError(errorMessage(profileFailure));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const guestPanel = (
    <div className="panel profile-panel">
      <div className="profile-head">
        <div className="profile-avatar">
          <UserRound size={28} aria-hidden="true" />
        </div>
        <div className="profile-meta">
          <p className="profile-name">Гость</p>
          <p className="profile-sub">
            Локальный профиль · данные коллекции хранятся в браузере
          </p>
        </div>
        <span className="profile-rating">
          <Star size={14} aria-hidden="true" />
          Нет рейтинга
        </span>
      </div>

      <div className="profile-columns">
        <div className="spec-box">
          <h4>Профиль</h4>
          <SpecRow label="Имя" value="—" />
          <SpecRow label="Город" value="—" />
          <SpecRow label="Телефон" value="—" />
        </div>
        <div className="spec-box">
          <h4>Статистика</h4>
          <SpecRow label="Рейтинг" value="—" />
          <SpecRow label="Отзывы" value="0" />
          <SpecRow label="Сделки" value="0" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT / PROFILE"
        title="Аккаунт"
        description="Профиль коллекционера, рейтинг и отзывы. Оплата и доставка по сделкам происходят вне сайта."
      />

      {status === 'checking' && (
        <div className="panel account-notice">
          <div>
            <strong>Проверяем сервер</strong>
            <p>Подключаемся к API и восстанавливаем сессию.</p>
          </div>
        </div>
      )}

      {status === 'offline' && (
        <>
          <div className="panel account-notice">
            <div>
              <strong>API недоступен</strong>
              <p>
                Приложение работает в локальном демо-режиме. Коллекция и объявления
                сохраняются в браузере. Запустите PostgreSQL и API, чтобы включить
                аккаунты и сделки.
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void refresh()}
            >
              <RefreshCw size={15} aria-hidden="true" />
              Проверить снова
            </button>
          </div>
          {guestPanel}
        </>
      )}

      {status === 'api' && !user && (
        <div className="panel account-auth">
          <div className="account-auth__tabs" role="tablist" aria-label="Вход или регистрация">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'login'}
              className={`account-auth__tab${authMode === 'login' ? ' is-active' : ''}`}
              onClick={() => {
                setAuthMode('login');
                setAuthError('');
              }}
            >
              Вход
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'register'}
              className={`account-auth__tab${authMode === 'register' ? ' is-active' : ''}`}
              onClick={() => {
                setAuthMode('register');
                setAuthError('');
              }}
            >
              Регистрация
            </button>
          </div>

          <form className="market-form account-form" onSubmit={handleAuth}>
            {authMode === 'register' && (
              <FormField id="accountDisplayName" label="Отображаемое имя">
                <input
                  id="accountDisplayName"
                  className="form-control"
                  type="text"
                  required
                  minLength={2}
                  maxLength={40}
                  autoComplete="nickname"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </FormField>
            )}

            <FormField id="accountEmail" label="Email">
              <input
                id="accountEmail"
                className="form-control"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>

            <FormField id="accountPassword" label="Пароль">
              <input
                id="accountPassword"
                className="form-control"
                type="password"
                required
                minLength={authMode === 'register' ? 8 : 1}
                maxLength={128}
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </FormField>

            {authError && (
              <p className="market-form__error" role="alert">
                {authError}
              </p>
            )}

            <div className="market-form__actions">
              <button
                type="submit"
                className="market-form__submit"
                disabled={isAuthenticating}
              >
                <LogIn size={15} aria-hidden="true" />
                {isAuthenticating
                  ? 'Подключаемся…'
                  : authMode === 'login'
                    ? 'Войти'
                    : 'Создать аккаунт'}
              </button>
            </div>
          </form>

          <p className="market-form__hint">
            Демо-аккаунт: demo@discvault.local / demo12345
          </p>
        </div>
      )}

      {status === 'api' && user && (
        <>
          <div className="panel profile-panel">
            <div className="profile-head">
              {user.avatarUrl ? (
                <img className="profile-avatar" src={user.avatarUrl} alt="" />
              ) : (
                <div className="profile-avatar">
                  <UserRound size={28} aria-hidden="true" />
                </div>
              )}
              <div className="profile-meta">
                <p className="profile-name">{user.displayName}</p>
                <p className="profile-sub">
                  {user.email ?? 'email скрыт'} · на сайте с{' '}
                  {formatMemberSince(user.createdAt)}
                </p>
              </div>
              <span className="profile-rating">
                <Star size={14} aria-hidden="true" />
                {user.rating === null
                  ? 'Нет рейтинга'
                  : `${user.rating.toFixed(1)} · ${user.reviewCount}`}
              </span>
            </div>

            <div className="profile-columns">
              <div className="spec-box">
                <h4>Профиль</h4>
                <SpecRow label="Имя" value={user.displayName} />
                <SpecRow label="Город" value={user.city ?? '—'} />
                <SpecRow label="Телефон" value={user.phone ?? '—'} />
              </div>
              <div className="spec-box">
                <h4>Статистика</h4>
                <SpecRow label="Рейтинг" value={user.rating === null ? '—' : `${user.rating.toFixed(1)}/5`} />
                <SpecRow label="Отзывы" value={String(user.reviewCount)} />
                <SpecRow label="Сделки" value={String(user.dealsCompleted)} />
              </div>
            </div>

            <div className="profile-actions">
              <Link className="btn-secondary" to={`/users/${encodeURIComponent(user.id)}`}>Публичный профиль</Link>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void refresh()}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Обновить
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void logout()}
              >
                <LogOut size={15} aria-hidden="true" />
                Выйти
              </button>
            </div>

            <form className="market-form account-form" onSubmit={handleProfileSave}>
              <div className="market-form__grid">
                <FormField id="profileName" label="Отображаемое имя">
                  <input
                    id="profileName"
                    className="form-control"
                    type="text"
                    required
                    minLength={2}
                    maxLength={40}
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                  />
                </FormField>
                <FormField id="profilePhone" label="Телефон">
                  <input
                    id="profilePhone"
                    className="form-control"
                    type="tel"
                    maxLength={30}
                    value={profilePhone}
                    onChange={(event) => setProfilePhone(event.target.value)}
                  />
                </FormField>
                <FormField id="profileCity" label="Город">
                  <input
                    id="profileCity"
                    className="form-control"
                    type="text"
                    maxLength={80}
                    value={profileCity}
                    onChange={(event) => setProfileCity(event.target.value)}
                  />
                </FormField>
              </div>

              {profileError && (
                <p className="market-form__error" role="alert">
                  {profileError}
                </p>
              )}
              {profileMessage && (
                <p className="market-form__hint">{profileMessage}</p>
              )}

              <div className="market-form__actions">
                <button
                  type="submit"
                  className="market-form__submit"
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? 'Сохраняем…' : 'Сохранить профиль'}
                </button>
              </div>
            </form>
          </div>

          <div className="panel account-deals-panel">
            <div className="account-deals-panel__head">
              <div>
                <h3 className="panel-title">Сделки</h3>
                <p className="panel-hint">
                  Завершайте сделки и оставляйте отзывы контрагентам.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                disabled={isLoadingDeals}
                onClick={() => void loadDeals()}
              >
                <RefreshCw size={15} aria-hidden="true" />
                {isLoadingDeals ? 'Загружаем…' : 'Обновить'}
              </button>
            </div>

            {dealsError && (
              <p className="market-form__error" role="alert">
                {dealsError}
              </p>
            )}

            {deals.length === 0 ? (
              <p className="panel-hint">
                {isLoadingDeals ? 'Загружаем сделки…' : 'Сделок пока нет.'}
              </p>
            ) : (
              <div className="account-deals">
                {deals.map((deal) => (
                  <DealRow
                    key={deal.id}
                    deal={deal}
                    currentUserId={user.id}
                    onRefresh={loadDeals}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
