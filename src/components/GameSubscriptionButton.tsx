import { Bell, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { cx } from '../lib/cx';

interface GameSubscriptionButtonProps {
  gameId: string;
  className?: string;
}

/** Follow/unfollow control used in the game drawer. */
export function GameSubscriptionButton({
  gameId,
  className,
}: GameSubscriptionButtonProps) {
  const { status, isAuthenticated } = useAuth();
  const { isFollowingGame, toggleGameSubscription } = useNotifications();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (status !== 'api') return null;

  if (!isAuthenticated) {
    return (
      <Link className={cx('btn-collection game-subscribe', className)} to="/account">
        <Bell size={15} aria-hidden="true" />
        Войти, чтобы следить
      </Link>
    );
  }

  const isFollowing = isFollowingGame(gameId);

  const handleToggle = async () => {
    setIsSubmitting(true);
    setError('');
    const message = await toggleGameSubscription(gameId);
    if (message) setError(message);
    setIsSubmitting(false);
  };

  return (
    <div className={cx('game-subscribe-wrap', className)}>
      <button
        type="button"
        className={cx(
          'btn-collection game-subscribe',
          isFollowing && 'game-subscribe--active',
        )}
        aria-pressed={isFollowing}
        disabled={isSubmitting}
        onClick={() => void handleToggle()}
        title={
          isFollowing
            ? 'Вы получаете уведомления о новых лотах и объявлениях этой игры'
            : 'Получать уведомления о новых лотах и объявлениях этой игры'
        }
      >
        {isFollowing ? (
          <CheckCircle2 size={15} aria-hidden="true" />
        ) : (
          <Bell size={15} aria-hidden="true" />
        )}
        {isFollowing ? 'Вы следите за игрой' : 'Следить за игрой'}
      </button>
      {error && (
        <span className="game-subscribe__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
