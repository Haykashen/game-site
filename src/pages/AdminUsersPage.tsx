import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  AdminUserDto,
  AdminUserSortDir,
  AdminUserSortField,
  UserRole,
  UserStatus,
} from '@discvault/shared';
import { errorMessage, listAdminUsers } from '../api';
import { PageHeading } from '../components/PageHeading';
import { useAuth } from '../context/AuthContext';

type RoleFilter = 'all' | UserRole;
type StatusFilter = 'all' | UserStatus;

interface ColumnFilters {
  search: string;
  role: RoleFilter;
  status: StatusFilter;
  listings: string;
  deals: string;
  copies: string;
  rating: string;
  createdAt: string;
}

const PAGE_SIZE = 20;

const INITIAL_FILTERS: ColumnFilters = {
  search: '',
  role: 'all',
  status: 'all',
  listings: '',
  deals: '',
  copies: '',
  rating: '',
  createdAt: '',
};

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

function filtersEqual(left: ColumnFilters, right: ColumnFilters): boolean {
  return (
    left.search.trim() === right.search.trim() &&
    left.role === right.role &&
    left.status === right.status &&
    left.listings === right.listings &&
    left.deals === right.deals &&
    left.copies === right.copies &&
    left.rating === right.rating &&
    left.createdAt === right.createdAt
  );
}

function optionalInteger(value: string): number | undefined {
  if (!value.trim()) return undefined;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function optionalRating(value: string): number | undefined {
  if (!value.trim()) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 5
    ? parsed
    : undefined;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);

    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
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

function SortableHeader({
  field,
  label,
  sortBy,
  sortDir,
  onSort,
}: {
  field: AdminUserSortField;
  label: string;
  sortBy: AdminUserSortField;
  sortDir: AdminUserSortDir;
  onSort: (field: AdminUserSortField) => void;
}) {
  const isActive = sortBy === field;
  const ariaSort: 'ascending' | 'descending' | 'none' = isActive
    ? sortDir === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';

  return (
    <th scope="col" aria-sort={ariaSort}>
      <button
        type="button"
        className={`admin-users__sort${isActive ? ' is-active' : ''}`}
        title={
          isActive
            ? `Изменить направление сортировки по полю «${label}»`
            : `Сортировать по полю «${label}»`
        }
        onClick={() => onSort(field)}
      >
        {label}
        {isActive ? (
          sortDir === 'asc' ? (
            <ArrowUp size={13} aria-hidden="true" />
          ) : (
            <ArrowDown size={13} aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown size={13} aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

/** Administrator-only directory of all registered accounts. */
export function AdminUsersPage() {
  const { user, isAdmin, status: apiStatus } = useAuth();
  const [filterDrafts, setFilterDrafts] =
    useState<ColumnFilters>(INITIAL_FILTERS);
  const [filters, setFilters] = useState<ColumnFilters>(INITIAL_FILTERS);
  const [sortBy, setSortBy] = useState<AdminUserSortField>('createdAt');
  const [sortDir, setSortDir] = useState<AdminUserSortDir>('desc');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const debouncedFilters = useDebouncedValue(filterDrafts, 300);
  const appliedFiltersRef = useRef(filters);

  useEffect(() => {
    appliedFiltersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    if (filtersEqual(appliedFiltersRef.current, debouncedFilters)) return;

    setFilters(debouncedFilters);
    setPage(1);
  }, [debouncedFilters]);

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
        search: filters.search.trim() || undefined,
        role: filters.role,
        status: filters.status,
        sortBy,
        sortDir,
        listings: optionalInteger(filters.listings),
        deals: optionalInteger(filters.deals),
        copies: optionalInteger(filters.copies),
        rating: optionalRating(filters.rating),
        createdAt: filters.createdAt || undefined,
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
  }, [filters, isAdmin, page, sortBy, sortDir]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function updateFilter<K extends keyof ColumnFilters>(
    key: K,
    value: ColumnFilters[K],
  ) {
    setFilterDrafts((current) => ({ ...current, [key]: value }));
  }

  function handleSort(field: AdminUserSortField) {
    setPage(1);

    if (field === sortBy) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(field);
    setSortDir(field === 'createdAt' ? 'desc' : 'asc');
  }

  function resetFilters() {
    setFilterDrafts(INITIAL_FILTERS);
    setFilters(INITIAL_FILTERS);
    setPage(1);
  }

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
  const hasActiveFilters = !filtersEqual(filterDrafts, INITIAL_FILTERS);

  return (
    <>
      <PageHeading
        eyebrow="ADMIN / USERS"
        title="Пользователи"
        description="Все зарегистрированные аккаунты с ролями, статусами, активностью на маркете и датой регистрации. Сортируйте по заголовкам и фильтруйте по столбцам."
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
      ) : (
        <>
          <div className="panel analytics-table-panel admin-users__panel">
            <div className="admin-users__table-toolbar">
              <span className="admin-reports__count">
                {isLoading ? 'Загружаем…' : `Всего: ${formatCount(total)}`}
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn-secondary admin-users__reset"
                  onClick={resetFilters}
                >
                  <X size={14} aria-hidden="true" />
                  Сбросить фильтры
                </button>
              )}
            </div>

            <div className="analytics-table-wrap">
              <table className="analytics-table admin-users__table">
                <thead>
                  <tr>
                    <SortableHeader
                      field="user"
                      label="Пользователь"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      field="role"
                      label="Роль"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      field="status"
                      label="Статус"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      field="listings"
                      label="Лоты"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      field="deals"
                      label="Сделки"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      field="copies"
                      label="Коллекция"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      field="rating"
                      label="Рейтинг"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      field="createdAt"
                      label="Регистрация"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                  </tr>
                  <tr className="admin-users__column-filters">
                    <th>
                      <input
                        className="form-control admin-users__column-input"
                        type="search"
                        value={filterDrafts.search}
                        placeholder="Имя или почта"
                        maxLength={120}
                        aria-label="Поиск по имени или почте"
                        onChange={(event) =>
                          updateFilter('search', event.target.value)
                        }
                      />
                    </th>
                    <th>
                      <select
                        className="form-control admin-users__column-input"
                        value={filterDrafts.role}
                        aria-label="Фильтр по роли"
                        onChange={(event) =>
                          updateFilter('role', event.target.value as RoleFilter)
                        }
                      >
                        <option value="all">Все</option>
                        <option value="admin">Администраторы</option>
                        <option value="moderator">Модераторы</option>
                        <option value="user">Пользователи</option>
                      </select>
                    </th>
                    <th>
                      <select
                        className="form-control admin-users__column-input"
                        value={filterDrafts.status}
                        aria-label="Фильтр по статусу"
                        onChange={(event) =>
                          updateFilter(
                            'status',
                            event.target.value as StatusFilter,
                          )
                        }
                      >
                        <option value="all">Все</option>
                        <option value="active">Активные</option>
                        <option value="suspended">Заблокированные</option>
                        <option value="deleted">Удалённые</option>
                      </select>
                    </th>
                    <th>
                      <input
                        className="form-control admin-users__column-input admin-users__column-input--number"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={filterDrafts.listings}
                        placeholder="—"
                        aria-label="Фильтр по количеству лотов"
                        onChange={(event) =>
                          updateFilter('listings', event.target.value)
                        }
                      />
                    </th>
                    <th>
                      <input
                        className="form-control admin-users__column-input admin-users__column-input--number"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={filterDrafts.deals}
                        placeholder="—"
                        aria-label="Фильтр по количеству сделок"
                        onChange={(event) =>
                          updateFilter('deals', event.target.value)
                        }
                      />
                    </th>
                    <th>
                      <input
                        className="form-control admin-users__column-input admin-users__column-input--number"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={filterDrafts.copies}
                        placeholder="—"
                        aria-label="Фильтр по размеру коллекции"
                        onChange={(event) =>
                          updateFilter('copies', event.target.value)
                        }
                      />
                    </th>
                    <th>
                      <input
                        className="form-control admin-users__column-input admin-users__column-input--number"
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        inputMode="decimal"
                        value={filterDrafts.rating}
                        placeholder="4.5"
                        aria-label="Фильтр по рейтингу"
                        onChange={(event) =>
                          updateFilter('rating', event.target.value)
                        }
                      />
                    </th>
                    <th>
                      <input
                        className="form-control admin-users__column-input"
                        type="date"
                        value={filterDrafts.createdAt}
                        aria-label="Фильтр по дате регистрации"
                        onChange={(event) =>
                          updateFilter('createdAt', event.target.value)
                        }
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && users.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="admin-users__empty-row">
                          <RefreshCw
                            className="market-photo-spin"
                            size={18}
                            aria-hidden="true"
                          />
                          <span>Загружаем пользователей…</span>
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="admin-users__empty-row">
                          <Users size={20} aria-hidden="true" />
                          <span>
                            По выбранным фильтрам пользователи не найдены.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    users.map((item) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {users.length > 0 && (page > 1 || hasMore) && (
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
