import { Bell, Moon, Sun, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { BrandMark } from '../components/BrandMark';
import { IconButton } from '../components/ui/IconButton';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { useThemeContext } from '../context/ThemeContext';
import { cx } from '../lib/cx';
import { DEFAULT_BANNER, HEADER_BANNERS, PROFILE_BANNER } from './headerBanners';
import { findNavItem } from './navigation';

/** Sticky utility bar with a page-specific banner, title, locale, theme and account. */
export function TopBar() {
  const { pathname } = useLocation();
  const { toggleTheme } = useThemeContext();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const section = findNavItem(pathname);
  const isProfile = pathname.startsWith('/users/');
  const banner = section ? HEADER_BANNERS[section.id] : isProfile ? PROFILE_BANNER : DEFAULT_BANNER;
  const BannerIcon = section?.icon ?? UserRound;
  const pageTitle = section?.pageTitle ?? (isProfile ? 'Профиль коллекционера' : 'DiscVault');
  const notificationLabel =
    unreadCount > 0
      ? `Уведомления: ${unreadCount} непрочитанных`
      : 'Уведомления';

  return (
    <div className={cx('app-topbar', `app-topbar--${banner.tone}`)}>
      <div className="app-topbar__banner" aria-hidden="true">
        <span className="app-topbar__banner-grid" />
        <span className="app-topbar__banner-art">
          <BannerIcon size={118} strokeWidth={1.1} />
        </span>
        <span className="app-topbar__banner-rule" />
      </div>

      <Link to="/games" className="app-topbar__brand" aria-label="DiscVault — каталог игр">
        <BrandMark className="app-topbar__brand-mark" size={30} />
      </Link>

      <div className="app-topbar__heading">
        <span className="app-topbar__eyebrow" aria-hidden="true">{banner.kicker}</span>
        <span className="app-topbar__title">{pageTitle}</span>
      </div>

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
