import {
  Activity,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardCheck,
  Gamepad2,
  Gavel,
  RefreshCw,
  ShieldCheck,
  Tag,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  AdminAnalyticsDto,
  AnalyticsGameDto,
  AnalyticsPeriod,
  AnalyticsRoleDto,
  AnalyticsTrendDto,
  AnalyticsUserDto,
} from '@discvault/shared';
import { errorMessage, fetchAdminAnalytics } from '../api';
import { PageHeading } from '../components/PageHeading';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../lib/formatPrice';

const PERIOD_OPTIONS: ReadonlyArray<{
  value: AnalyticsPeriod;
  label: string;
}> = [
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: '90d', label: '90 дней' },
  { value: '365d', label: '12 месяцев' },
];

const ROLE_LABELS: Record<AnalyticsRoleDto['role'], string> = {
  admin: 'Администраторы',
  moderator: 'Модераторы',
  user: 'Пользователи',
};

const countFormatter = new Intl.NumberFormat('ru-RU');
const generatedAtFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatCount(value: number): string {
  return countFormatter.format(value);
}

function formatMinor(value: number): string {
  return formatPrice(Math.round(value / 100));
}

function formatRating(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)} / 10`;
}

function barHeight(value: number, max: number): string {
  if (value <= 0) return '0%';
  return `${Math.max(5, Math.round((value / max) * 100))}%`;
}

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}

function KpiCard({ icon: Icon, label, value, hint }: KpiCardProps) {
  return (
    <article className="analytics-kpi">
      <span className="analytics-kpi__icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="analytics-kpi__copy">
        <span className="analytics-kpi__label">{label}</span>
        <strong className="analytics-kpi__value">{value}</strong>
        <span className="analytics-kpi__hint">{hint}</span>
      </div>
    </article>
  );
}

function TrendChart({ trend }: { trend: AnalyticsTrendDto }) {
  const max = Math.max(
    1,
    ...trend.points.flatMap((point) => [
      point.users,
      point.entries,
      point.deals,
    ]),
  );
  const labelEvery = Math.max(1, Math.ceil(trend.points.length / 8));

  return (
    <div className="analytics-chart__scroll">
      <div className="analytics-chart__plot">
        {trend.points.map((point, index) => {
          const showLabel =
            index % labelEvery === 0 || index === trend.points.length - 1;

          return (
            <div
              className="analytics-chart__bucket"
              key={point.date}
              title={`${point.label}: ${point.users} пользователей, ${point.entries} лотов, ${point.deals} сделок`}
            >
              <div className="analytics-chart__bars" aria-hidden="true">
                <span
                  className="analytics-chart__bar analytics-chart__bar--users"
                  style={{ height: barHeight(point.users, max) }}
                />
                <span
                  className="analytics-chart__bar analytics-chart__bar--entries"
                  style={{ height: barHeight(point.entries, max) }}
                />
                <span
                  className="analytics-chart__bar analytics-chart__bar--deals"
                  style={{ height: barHeight(point.deals, max) }}
                />
              </div>
              <span className="analytics-chart__label">
                {showLabel ? point.label : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GameCell({ game }: { game: AnalyticsGameDto }) {
  return (
    <Link
      className="analytics-game"
      to={`/games?game=${encodeURIComponent(game.id)}`}
    >
      {game.coverImage ? (
        <img className="analytics-game__cover" src={game.coverImage} alt="" />
      ) : (
        <span
          className="analytics-game__cover analytics-game__cover--empty"
          aria-hidden="true"
        >
          <Gamepad2 size={16} />
        </span>
      )}
      <span className="analytics-game__copy">
        <strong>{game.title}</strong>
        <small>
          {game.year}
          {game.publisher ? ` · ${game.publisher}` : ''}
        </small>
      </span>
    </Link>
  );
}

function UserCell({ user }: { user: AnalyticsUserDto }) {
  return (
    <Link
      className="analytics-user"
      to={`/users/${encodeURIComponent(user.id)}`}
    >
      {user.avatarUrl ? (
        <img className="analytics-user__avatar" src={user.avatarUrl} alt="" />
      ) : (
        <span className="analytics-user__avatar analytics-user__avatar--empty">
          {user.displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="analytics-user__name">{user.displayName}</span>
    </Link>
  );
}

interface UserTableProps {
  users: AnalyticsUserDto[];
  metric: 'deals' | 'copies';
  emptyText: string;
}

function UserTable({ users, metric, emptyText }: UserTableProps) {
  if (users.length === 0) {
    return <p className="analytics-empty">{emptyText}</p>;
  }

  const showGmv = metric === 'deals';

  return (
    <div className="analytics-table-wrap">
      <table className="analytics-table analytics-table--compact">
        <thead>
          <tr>
            <th>Пользователь</th>
            <th>{metric === 'deals' ? 'Сделки' : 'Копии'}</th>
            {showGmv && <th>GMV</th>}
            <th>Лоты</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <UserCell user={user} />
              </td>
              <td>
                {metric === 'deals'
                  ? formatCount(user.deals)
                  : formatCount(user.copies)}
              </td>
              {showGmv && <td>{formatMinor(user.gmvMinor)}</td>}
              <td>{formatCount(user.listings)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoleDistribution({ roles }: { roles: AnalyticsRoleDto[] }) {
  const total = roles.reduce((sum, role) => sum + role.count, 0);

  return (
    <div className="analytics-role-list">
      {roles.map((role) => {
        const percent = total > 0 ? Math.round((role.count / total) * 100) : 0;

        return (
          <div className="analytics-role" key={role.role}>
            <div className="analytics-role__head">
              <span>{ROLE_LABELS[role.role]}</span>
              <strong>{formatCount(role.count)}</strong>
            </div>
            <div className="analytics-role__track" aria-hidden="true">
              <span
                className="analytics-role__fill"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Admin dashboard for catalogue, market and user analytics. */
export function AdminAnalyticsPage() {
  const { user, isModerator, status: apiStatus } = useAuth();
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [data, setData] = useState<AdminAnalyticsDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!isModerator) {
      setData(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError('');

    fetchAdminAnalytics(period, controller.signal)
      .then((response) => {
        setData(response);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(errorMessage(loadError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [isModerator, period, reloadToken]);

  if (!isModerator && apiStatus === 'checking') {
    return (
      <>
        <PageHeading
          eyebrow="ADMIN / ANALYTICS"
          title="Аналитика"
          description="Проверяем доступ к разделу аналитики."
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
          eyebrow="ADMIN / ANALYTICS"
          title="Аналитика"
          description={
            isOffline
              ? 'Аналитика доступна в сетевом режиме, когда подключены API и база данных.'
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
                ? 'В автономном режиме нет данных пользователей и серверной статистики. Запустите API с PostgreSQL, чтобы открыть аналитику.'
                : user
                  ? 'Этот аккаунт не имеет доступа к административной аналитике.'
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
        eyebrow="ADMIN / ANALYTICS"
        title="Аналитика"
        description="Пользователи, каталог игр, активность на маркете и сделки в одном срезе."
        action={
          <button
            type="button"
            className="btn-secondary"
            disabled={isLoading}
            onClick={() => setReloadToken((value) => value + 1)}
          >
            <RefreshCw
              className={isLoading ? 'market-photo-spin' : ''}
              size={15}
              aria-hidden="true"
            />
            {isLoading ? 'Обновляем…' : 'Обновить'}
          </button>
        }
      />

      <div className="panel analytics-toolbar">
        <label className="analytics-toolbar__period">
          <span className="form-label">Период</span>
          <select
            className="form-control"
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value as AnalyticsPeriod)
            }
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span className="analytics-toolbar__updated">
          {data
            ? `Обновлено ${generatedAtFormatter.format(
                new Date(data.generatedAt),
              )}`
            : 'Загружаем данные…'}
        </span>
      </div>

      {error && (
        <p className="market-form__error" role="alert">
          {error}
        </p>
      )}

      {isLoading && !data && (
        <div className="panel analytics-loading">
          <RefreshCw className="market-photo-spin" size={18} aria-hidden="true" />
          Собираем статистику…
        </div>
      )}

      {data && (
        <>
          <section className="analytics-kpi-grid" aria-label="Ключевые показатели">
            <KpiCard
              icon={Users}
              label="Пользователи"
              value={formatCount(data.overview.users.total)}
              hint={`+${formatCount(
                data.overview.users.newInPeriod,
              )} за период · ${formatCount(
                data.overview.users.active,
              )} активных`}
            />
            <KpiCard
              icon={Gamepad2}
              label="Игры"
              value={formatCount(data.overview.games.total)}
              hint={`+${formatCount(
                data.overview.games.newInPeriod,
              )} за период · ${formatCount(
                data.overview.games.editions,
              )} изданий`}
            />
            <KpiCard
              icon={Tag}
              label="Активные лоты"
              value={formatCount(
                data.overview.market.activeListings +
                  data.overview.market.activeAuctions,
              )}
              hint={`${formatCount(
                data.overview.market.activeListings,
              )} объявлений · ${formatCount(
                data.overview.market.activeAuctions,
              )} аукционов`}
            />
            <KpiCard
              icon={ClipboardCheck}
              label="На проверке"
              value={formatCount(
                data.overview.moderation.pendingMarketEntries,
              )}
              hint="Новые лоты ждут публикации"
            />
            <KpiCard
              icon={CircleDollarSign}
              label="Сделки"
              value={formatCount(data.overview.market.completedDeals)}
              hint={`+${formatCount(
                data.overview.market.completedDealsInPeriod,
              )} за период · ${formatMinor(
                data.overview.market.gmvInPeriodMinor,
              )}`}
            />
            <KpiCard
              icon={Gavel}
              label="Ставки"
              value={formatCount(data.overview.market.bids)}
              hint={`${formatCount(
                data.overview.market.entriesInPeriod,
              )} новых лотов за период`}
            />
            <KpiCard
              icon={ShieldCheck}
              label="Жалобы"
              value={formatCount(data.overview.moderation.pendingReports)}
              hint="Ожидают решения модераторов"
            />
          </section>

          <section className="panel analytics-chart">
            <div className="analytics-section__head">
              <div>
                <h2 className="panel-title">Динамика</h2>
                <p className="panel-hint">
                  Новые пользователи, лоты и завершённые сделки за выбранный
                  период.
                </p>
              </div>
              <div className="analytics-legend" aria-label="Легенда графика">
                <span className="analytics-legend__item analytics-legend__item--users">
                  Пользователи
                </span>
                <span className="analytics-legend__item analytics-legend__item--entries">
                  Лоты
                </span>
                <span className="analytics-legend__item analytics-legend__item--deals">
                  Сделки
                </span>
              </div>
            </div>

            {data.trend.points.length > 0 ? (
              <TrendChart trend={data.trend} />
            ) : (
              <p className="analytics-empty">Нет данных за выбранный период.</p>
            )}
          </section>

          <section className="analytics-section">
            <div className="analytics-section__head">
              <div>
                <h2 className="analytics-section__title">Игры</h2>
                <p className="panel-hint">
                  Топ по активности за период. Коллекции, издания и рейтинг
                  считаются за всё время.
                </p>
              </div>
              <span className="analytics-section__badge">
                <ChartNoAxesCombined size={14} aria-hidden="true" />
                {formatCount(data.topGames.length)} в топе
              </span>
            </div>

            <div className="panel analytics-table-panel">
              {data.topGames.length === 0 ? (
                <p className="analytics-empty">
                  За выбранный период на маркете ещё не было активности по играм.
                </p>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Игра</th>
                        <th>Каталог</th>
                        <th>Лоты</th>
                        <th>Сделки</th>
                        <th>GMV</th>
                        <th>Рейтинг</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topGames.map((game) => (
                        <tr key={game.id}>
                          <td>
                            <GameCell game={game} />
                          </td>
                          <td>
                            <strong>{formatCount(game.editions)}</strong>
                            <small>{formatCount(game.copies)} копий</small>
                          </td>
                          <td>
                            <strong>{formatCount(game.entries)}</strong>
                            <small>
                              {formatCount(game.activeEntries)} активных
                            </small>
                          </td>
                          <td>
                            <strong>{formatCount(game.deals)}</strong>
                            <small>
                              {game.deals > 0
                                ? `${formatMinor(
                                    game.averageDealMinor,
                                  )} средний`
                                : 'нет сделок'}
                            </small>
                          </td>
                          <td>{formatMinor(game.gmvMinor)}</td>
                          <td>
                            <strong>{formatRating(game.rating)}</strong>
                            <small>{formatCount(game.ratingsCount)} оценок</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="analytics-section">
            <div className="analytics-section__head">
              <div>
                <h2 className="analytics-section__title">Пользователи</h2>
                <p className="panel-hint">
                  Продавцы и покупатели — по завершённым сделкам за период.
                  Коллекционеры — по размеру полки.
                </p>
              </div>
              <span className="analytics-section__badge">
                <Activity size={14} aria-hidden="true" />
                {formatCount(data.overview.users.withCollection)} с коллекцией
              </span>
            </div>

            <div className="analytics-user-grid">
              <div className="panel analytics-table-panel">
                <div className="analytics-subhead">
                  <h3>Топ продавцов</h3>
                  <span>{formatCount(data.topSellers.length)}</span>
                </div>
                <UserTable
                  users={data.topSellers}
                  metric="deals"
                  emptyText="Пока нет завершённых продаж за период."
                />
              </div>

              <div className="panel analytics-table-panel">
                <div className="analytics-subhead">
                  <h3>Топ покупателей</h3>
                  <span>{formatCount(data.topBuyers.length)}</span>
                </div>
                <UserTable
                  users={data.topBuyers}
                  metric="deals"
                  emptyText="Пока нет завершённых покупок за период."
                />
              </div>

              <div className="panel analytics-table-panel">
                <div className="analytics-subhead">
                  <h3>Топ коллекционеров</h3>
                  <span>{formatCount(data.topCollectors.length)}</span>
                </div>
                <UserTable
                  users={data.topCollectors}
                  metric="copies"
                  emptyText="Пока нет пользователей с коллекциями."
                />
              </div>

              <div className="panel analytics-roles-panel">
                <div className="analytics-subhead">
                  <h3>Роли</h3>
                  <span>{formatCount(data.overview.users.total)}</span>
                </div>
                <RoleDistribution roles={data.roles} />
                <div className="analytics-roles-summary">
                  <span>
                    С коллекцией: {formatCount(data.overview.users.withCollection)}
                  </span>
                  <span>
                    С лотами: {formatCount(data.overview.users.withListings)}
                  </span>
                  <span>
                    Заблокированы: {formatCount(data.overview.users.suspended)}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
