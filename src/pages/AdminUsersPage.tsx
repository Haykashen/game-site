import {
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type {
  AdminUserDto,
  UserRole,
  UserStatus,
} from '@discvault/shared';
import { errorMessage, listAdminUsers } from '../api';
import { PageHeading } from '../components/PageHeading';
import { useAuth } from '../context/AuthContext';

type RoleFilter = 'all' | UserRole;
type StatusFilter = 'all' | UserStatus;

const PAGE_SIZE = 20;

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  moderator: 'Модератор',
  user: 'Пользователь',
};

const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Активен',
  suspended: 'Заблокирован',
  deleted: 'Удалён',
};

const numberFormatter = new Intl.NumberFormat('ru-RU');
const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatCount(value: number): string {
  return numberFormatter.format(value);
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function reviewCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${formatCount(count)} отзыв`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${formatCount(count)} отзыва`;
  }

  return `${formatCount(count)} отзывов`;
}

function UserIdentity({ user }: { user: AdminUserDto }) {
  return (
    <div className="admin-users__identity">
      {user.avatarUrl ? (
        <img className="admin-users__avatar" src={user.avatarUrl} alt="" />
      ) : (
        <span className="admin-users__avatar admin-users__avatar--empty">
          {user.displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="admin-users__identity-copy">
        {user.status === 'active' ? (
          <Link
            className="admin-users__name"
            to={`/users/${encodeURIComponent(user.id)}`}
          >
            {user.displayName}
          </Link>
        ) : (
          <span className="admin-users__name">{user.displayName}</span>
        )}
        <small>{user.email}</small>
        {user.isDemo && <small className="admin-users__demo">демо-аккаунт</small>}
      </span>
    </div>
  );
}

/** Administrator-only directory of all registered accounts. */
export function AdminUsersPage() {
  const { user, isAdmin, status: apiStatus } = useAuth();
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      setUsers([]);
      setTotal(0);
      setHasMore(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await listAdminUsers({
        search: search || undefined,
        role,
        status,
        page,
        pageSize: PAGE_SIZE,
      });
      setUsers(result.items);
      setTotal(result.total);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setUsers([]);
      setTotal(0);
      setHasMore(false);
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, page, role, search, status]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchDraft.trim());
    setPage(1);
  };

  if (!isAdmin && apiStatus === 'checking') {
    return (
      <>
        <PageHeading
          eyebrow="ADMIN / USERS"
          title="Пользователи"
          description="Проверяем доступ к списку пользователей."
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

  if (!isAdmin) {
    const isOffline = apiStatus === 'offline';

    return (
      <>
        <PageHeading
          eyebrow="ADMIN / USERS"
          title="Пользователи"
          description={
            isOffline
              ? 'Список пользователей доступен в сетевом режиме, когда подключены API и база данных.'
              : 'Раздел доступен только администраторам.'
          }
        />
        <div className="panel account-notice">
          <div>
            <strong>
              {isOffline ? 'Нет подключения к API' : 'Недостаточно прав'}
            </strong>
            <p>
              {isOffline
                ? 'В автономном режиме список пользователей недоступен. Запустите API с PostgreSQL, чтобы открыть раздел.'
                : user
                  ? 'Этот аккаунт не имеет доступа к управлению пользователями.'
                  : 'Войдите в аккаунт администратора.'}
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeading
        eyebrow="ADMIN / USERS"
        title="Пользователи"
        description="Все зарегистрированные аккаунты с ролями, статусами, активностью на маркете и датой регистрации."
        action={
          <button
            type="button"
            className="btn-secondary"
            disabled={isLoading}
            onClick={() => void loadUsers()}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {isLoading ? 'Обновляем…' : 'Обновить'}
          </button>
        }
      />

      <div className="admin-reports__filters panel admin-users__filters">
        <form className="admin-users__search" onSubmit={handleSearch}>
          <label>
            <span className="form-label">Поиск</span>
            <span className="admin-users__search-row">
              <input
                className="form-control"
                type="search"
                value={searchDraft}
                placeholder="Имя или почта"
                onChange={(event) => setSearchDraft(event.target.value)}
              />
              <button className="btn-secondary" type="submit">
                <Search size={15} aria-hidden="true" />
                Найти
              </button>
            </span>
          </label>
        </form>

        <label>
          <span className="form-label">Роль</span>
          <select
            className="form-control"
            value={role}
            onChange={(event) => {
              setRole(event.target.value as RoleFilter);
              setPage(1);
            }}
          >
            <option value="all">Все</option>
            <option value="admin">Администраторы</option>
            <option value="moderator">Модераторы</option>
            <option value="user">Пользователи</option>
          </select>
        </label>

        <label>
          <span className="form-label">Статус</span>
          <select
            className="form-control"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="all">Все</option>
            <option value="active">Активные</option>
            <option value="suspended">Заблокированные</option>
            <option value="deleted">Удалённые</option>
          </select>
        </label>

        <span className="admin-reports__count">
          {isLoading ? 'Загружаем…' : `Всего: ${formatCount(total)}`}
        </span>
      </div>

      {error ? (
        <div className="panel admin-users__state">
          <div>
            <strong>Не удалось загрузить пользователей</strong>
            <p>{error}</p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void loadUsers()}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Повторить
          </button>
        </div>
      ) : isLoading && users.length === 0 ? (
        <div className="panel admin-users__state">
          <Users size={22} aria-hidden="true" />
          <p>Загружаем пользователей…</p>
        </div>
      ) : users.length === 0 ? (
        <div className="panel admin-users__state">
          <Users size={22} aria-hidden="true" />
          <p>По выбранным фильтрам пользователи не найдены.</p>
        </div>
      ) : (
        <>
          <div className="panel analytics-table-panel admin-users__panel">
            <div className="analytics-table-wrap">
              <table className="analytics-table admin-users__table">
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>Роль</th>
                    <th>Статус</th>
                    <th>Лоты</th>
                    <th>Сделки</th>
                    <th>Коллекция</th>
                    <th>Рейтинг</th>
                    <th>Регистрация</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <UserIdentity user={item} />
                      </td>
                      <td>
                        <span
                          className={`admin-users__role admin-users__role--${item.role}`}
                        >
                          {ROLE_LABELS[item.role]}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`admin-users__status admin-users__status--${item.status}`}
                        >
                          {STATUS_LABELS[item.status]}
                        </span>
                        {item.status === 'suspended' &&
                          item.suspensionReason && (
                            <small className="admin-users__reason">
                              {item.suspensionReason}
                            </small>
                          )}
                      </td>
                      <td>
                        <strong>{formatCount(item.listings)}</strong>
                      </td>
                      <td>
                        <strong>{formatCount(item.deals)}</strong>
                      </td>
                      <td>
                        <strong>{formatCount(item.copies)}</strong>
                      </td>
                      <td>
                        {item.rating === null ? (
                          <span className="admin-users__muted">—</span>
                        ) : (
                          <strong>{item.rating.toFixed(1)}</strong>
                        )}
                        <small>
                          {item.reviewCount > 0
                            ? reviewCountLabel(item.reviewCount)
                            : 'нет отзывов'}
                        </small>
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(page > 1 || hasMore) && (
            <div className="admin-users__pagination">
              <button
                type="button"
                className="btn-secondary"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              >
                Назад
              </button>
              <span>
                Страница {page} из {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary"
                disabled={!hasMore || isLoading}
                onClick={() => setPage((previous) => previous + 1)}
              >
                Далее
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
