import {
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Flag,
  RefreshCw,
  ShieldBan,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  ReportAction,
  ReportDto,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '@discvault/shared';
import {
  errorMessage,
  listAdminReports,
  updateAdminReport,
  updateMarketModeration,
} from '../api';
import { PageHeading } from '../components/PageHeading';
import { useAuth } from '../context/AuthContext';

type StatusFilter = 'all' | ReportStatus;
type TargetTypeFilter = 'all' | ReportTargetType;

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Новая',
  in_review: 'В работе',
  resolved: 'Решена',
  dismissed: 'Отклонена',
};

const REASON_LABELS: Record<ReportReason, string> = {
  fraud: 'Мошенничество',
  prohibited: 'Запрещённый товар',
  offensive: 'Оскорбительное содержание',
  spam: 'Спам',
  wrong_category: 'Не та категория',
  other: 'Другое',
};

function formatReportDate(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function targetHref(report: ReportDto): string | null {
  if (report.marketEntry) {
    if (report.marketEntry.moderationStatus !== 'visible') return null;

    const section = report.marketEntry.kind === 'auction' ? 'auctions' : 'listings';
    return `/${section}?item=${encodeURIComponent(report.marketEntry.id)}`;
  }

  if (report.targetUser) {
    return `/users/${report.targetUser.id}`;
  }

  return null;
}

function targetLabel(report: ReportDto): string {
  if (report.marketEntry) {
    const kind = report.marketEntry.kind === 'auction' ? 'Аукцион' : 'Объявление';
    return `${kind}: ${report.marketEntry.title}`;
  }

  return report.targetUser?.displayName ?? 'Запись удалена';
}

/** Moderation queue for reports against lots and users. */
export function AdminReportsPage() {
  const { user, isModerator, status: apiStatus } = useAuth();
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [targetType, setTargetType] = useState<TargetTypeFilter>('all');
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!isModerator) {
      setReports([]);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const page = await listAdminReports({
        status,
        pageSize: 100,
        ...(targetType !== 'all' ? { targetType } : {}),
      });
      setReports(page.items);
    } catch (loadError) {
      setReports([]);
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [isModerator, status, targetType]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handleRestore = async (report: ReportDto) => {
    if (!report.marketEntry) return;

    setBusyId(report.id);
    setActionError('');

    try {
      await updateMarketModeration(report.marketEntry.id, {
        moderationStatus: 'visible',
        note: notes[report.id]?.trim() || null,
      });
      await loadReports();
    } catch (actionFailure) {
      setActionError(errorMessage(actionFailure));
    } finally {
      setBusyId(null);
    }
  };

  const handleAction = async (
    report: ReportDto,
    nextStatus: 'in_review' | 'resolved' | 'dismissed',
    action: ReportAction = 'none',
  ) => {
    if (action === 'hide_entry' || action === 'suspend_user') {
      const prompt =
        action === 'hide_entry'
          ? 'Скрыть объявление из публичной ленты?'
          : 'Заблокировать пользователя и завершить все его сессии?';

      if (!window.confirm(prompt)) return;
    }

    setBusyId(report.id);
    setActionError('');
    const note = notes[report.id]?.trim();

    try {
      await updateAdminReport(report.id, {
        status: nextStatus,
        action,
        ...(note ? { moderatorNote: note } : {}),
      });
      setNotes((previous) => {
        const next = { ...previous };
        delete next[report.id];
        return next;
      });
      await loadReports();
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
          title="Очередь жалоб"
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
    return (
      <>
        <PageHeading
          eyebrow="ADMIN / MODERATION"
          title="Очередь жалоб"
          description="Раздел доступен администраторам и модераторам."
        />
        <div className="panel account-notice">
          <div>
            <strong>Недостаточно прав</strong>
            <p>
              {user
                ? 'Этот аккаунт не имеет доступа к модерации.'
                : 'Войдите в аккаунт администратора или модератора.'}
            </p>
          </div>
          {!user && (
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
        title="Очередь жалоб"
        description="Проверяйте жалобы на лоты и пользователей, скрывайте объявления и блокируйте нарушителей."
        action={
          <button
            type="button"
            className="btn-secondary"
            disabled={isLoading}
            onClick={() => void loadReports()}
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
            <option value="pending">Новые</option>
            <option value="in_review">В работе</option>
            <option value="resolved">Решённые</option>
            <option value="dismissed">Отклонённые</option>
            <option value="all">Все</option>
          </select>
        </label>

        <label>
          <span className="form-label">Цель</span>
          <select
            className="form-control"
            value={targetType}
            onChange={(event) =>
              setTargetType(event.target.value as TargetTypeFilter)
            }
          >
            <option value="all">Все</option>
            <option value="market_entry">Объявления</option>
            <option value="user">Пользователи</option>
          </select>
        </label>
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

      {isLoading && reports.length === 0 ? (
        <div className="panel account-notice">
          <div>
            <strong>Загружаем жалобы</strong>
            <p>Получаем очередь модерации.</p>
          </div>
        </div>
      ) : reports.length === 0 ? (
        <div className="panel account-notice">
          <div>
            <strong>Жалоб нет</strong>
            <p>В выбранном фильтре пока нет обращений.</p>
          </div>
        </div>
      ) : (
        <div className="admin-reports">
          {reports.map((report) => {
            const href = targetHref(report);
            const isBusy = busyId === report.id;

            return (
              <article className="admin-report" key={report.id}>
                <div className="admin-report__head">
                  <div>
                    <p className="admin-report__reason">
                      <Flag size={14} aria-hidden="true" />
                      {REASON_LABELS[report.reason]}
                    </p>
                    <p className="admin-report__date">
                      {formatReportDate(report.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`admin-report__status admin-report__status--${report.status}`}
                  >
                    {STATUS_LABELS[report.status]}
                  </span>
                </div>

                <div className="admin-report__target">
                  <span className="admin-report__label">Цель</span>
                  {href ? (
                    <Link to={href}>{targetLabel(report)}</Link>
                  ) : (
                    <span>{targetLabel(report)}</span>
                  )}
                  {report.marketEntry && (
                    <span className="admin-report__muted">
                      Автор: {report.marketEntry.author.displayName}
                    </span>
                  )}
                  {report.marketEntry &&
                    report.marketEntry.moderationStatus !== 'visible' && (
                      <span className="admin-report__muted">скрыт модератором</span>
                    )}
                </div>

                <div className="admin-report__meta">
                  <span>
                    Автор жалобы:{' '}
                    <Link to={`/users/${report.reporter.id}`}>
                      {report.reporter.displayName}
                    </Link>
                  </span>
                  {report.moderator && (
                    <span>Модератор: {report.moderator.displayName}</span>
                  )}
                </div>

                {report.comment && (
                  <p className="admin-report__comment">{report.comment}</p>
                )}
                {report.moderatorNote && (
                  <p className="admin-report__note">
                    Комментарий модератора: {report.moderatorNote}
                  </p>
                )}

                <label className="admin-report__note-field">
                  <span className="form-label">Комментарий модератора</span>
                  <textarea
                    className="form-control"
                    rows={2}
                    maxLength={2000}
                    placeholder="Необязательно"
                    value={notes[report.id] ?? ''}
                    onChange={(event) =>
                      setNotes((previous) => ({
                        ...previous,
                        [report.id]: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="admin-report__actions">
                  {report.status === 'pending' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={isBusy}
                      onClick={() => void handleAction(report, 'in_review')}
                    >
                      <Clock3 size={15} aria-hidden="true" />
                      В работу
                    </button>
                  )}

                  {report.status !== 'resolved' && report.status !== 'dismissed' && (
                    <button
                      type="button"
                      className="btn-secondary admin-report__danger"
                      disabled={isBusy}
                      onClick={() => void handleAction(report, 'dismissed')}
                    >
                      <XCircle size={15} aria-hidden="true" />
                      Отклонить
                    </button>
                  )}

                  {report.status !== 'resolved' && report.status !== 'dismissed' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={isBusy}
                      onClick={() => void handleAction(report, 'resolved')}
                    >
                      <CheckCircle2 size={15} aria-hidden="true" />
                      Завершить
                    </button>
                  )}

                  {report.marketEntry && report.marketEntry.moderationStatus === 'visible' && (
                    <button
                      type="button"
                      className="btn-secondary admin-report__danger"
                      disabled={isBusy}
                      onClick={() =>
                        void handleAction(report, 'resolved', 'hide_entry')
                      }
                    >
                      <EyeOff size={15} aria-hidden="true" />
                      Скрыть лот
                    </button>
                  )}

                  {report.marketEntry && report.marketEntry.moderationStatus !== 'visible' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={isBusy}
                      onClick={() => void handleRestore(report)}
                    >
                      <Eye size={15} aria-hidden="true" />
                      Вернуть лот
                    </button>
                  )}

                  {(report.targetUser || report.marketEntry) &&
                    user?.role === 'admin' && (
                      <button
                        type="button"
                        className="btn-secondary admin-report__danger"
                        disabled={isBusy}
                        onClick={() =>
                          void handleAction(report, 'resolved', 'suspend_user')
                        }
                      >
                        <ShieldBan size={15} aria-hidden="true" />
                        Заблокировать
                      </button>
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
