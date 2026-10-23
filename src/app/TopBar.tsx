import { Bell, Disc, Moon, Sun, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { IconButton } from '../components/ui/IconButton';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { useThemeContext } from '../context/ThemeContext';
import { findNavItem } from './navigation';

/** Sticky utility bar: page title, locale, theme and account. */
export function TopBar() {
  const { pathname } = useLocation();
  const { toggleTheme } = useThemeContext();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const section = findNavItem(pathname);
  const notificationLabel =
    unreadCount > 0
      ? `Уведомления: ${unreadCount} непрочитанных`
      : 'Уведомления';

  return (
    <div className="app-topbar">
      <Link to="/games" className="app-topbar__brand" aria-label="RetroKeep — каталог игр">
        <span className="app-topbar__brand-mark">
          <Disc size={16} aria-hidden="true" />
        </span>
      </Link>

      <span className="app-topbar__title">{section?.pageTitle ?? 'RetroKeep'}</span>

      <div className="app-topbar__actions">
        <Link to="/settings" className="btn-lang" title="Язык и регион">
          RU
        </Link>
        <Link
          to="/notifications"
          className="topbar-notifications"
          aria-label={notificationLabel}
          title={notificationLabel}
        >
          <Bell size={19} aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="topbar-notifications__badge" aria-hidden="true">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        <IconButton label="Переключить тему" onClick={toggleTheme}>
          <Sun size={20} className="sun-icon" />
          <Moon size={20} className="moon-icon" />
        </IconButton>
        <Link
          to="/account"
          className="topbar-avatar"
          aria-label={user ? `Аккаунт: ${user.displayName}` : 'Аккаунт'}
          title={user ? user.displayName : 'Гость'}
        >
          <UserRound size={18} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
