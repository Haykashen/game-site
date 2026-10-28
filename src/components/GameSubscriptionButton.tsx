import { BellPlus, BellRing } from 'lucide-react';
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
      <Link className={cx('btn-icon game-subscribe', className)} to="/account" aria-label="Войти, чтобы следить за игрой" title="Войти, чтобы следить за игрой">
        <BellPlus size={18} aria-hidden="true" />
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
          'btn-icon game-subscribe',
          isFollowing && 'game-subscribe--active',
        )}
        aria-label={isFollowing ? 'Отписаться от игры' : 'Следить за игрой'}
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
          <BellRing size={18} aria-hidden="true" />
        ) : (
          <BellPlus size={18} aria-hidden="true" />
        )}
      </button>
      {error && (
        <span className="game-subscribe__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
