import { Bell, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import { cx } from '../../lib/cx';

interface EntrySubscriptionButtonProps {
  entryId: string;
  className?: string;
}

/** Follow/unfollow control for a single lot or listing. */
export function EntrySubscriptionButton({
  entryId,
  className,
}: EntrySubscriptionButtonProps) {
  const { status, isAuthenticated } = useAuth();
  const { isFollowingEntry, toggleEntrySubscription } = useNotifications();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (status !== 'api') return null;

  if (!isAuthenticated) {
    return (
      <Link className={cx('btn-collection entry-subscribe', className)} to="/account">
        <Bell size={15} aria-hidden="true" />
        Войти, чтобы следить за лотом
      </Link>
    );
  }

  const isFollowing = isFollowingEntry(entryId);

  const handleToggle = async () => {
    setIsSubmitting(true);
    setError('');
    const message = await toggleEntrySubscription(entryId);
    if (message) setError(message);
    setIsSubmitting(false);
  };

  return (
    <div className={cx('entry-subscribe-wrap', className)}>
      <button
        type="button"
        className={cx(
          'btn-collection entry-subscribe',
          isFollowing && 'entry-subscribe--active',
        )}
        aria-pressed={isFollowing}
        disabled={isSubmitting}
        onClick={() => void handleToggle()}
        title={
          isFollowing
            ? 'Вы получаете уведомления по этому лоту'
            : 'Получать уведомления о ставках, закрытии и изменениях лота'
        }
      >
        {isFollowing ? (
          <CheckCircle2 size={15} aria-hidden="true" />
        ) : (
          <Bell size={15} aria-hidden="true" />
        )}
        {isFollowing ? 'Вы следите за лотом' : 'Следить за лотом'}
      </button>
      {error && (
        <span className="entry-subscribe__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
