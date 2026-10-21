import { Disc, Moon, Sun, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { IconButton } from '../components/ui/IconButton';
import { useThemeContext } from '../context/ThemeContext';
import { findNavItem } from './navigation';

/** Sticky utility bar: page title, locale, theme and account. */
export function TopBar() {
  const { pathname } = useLocation();
  const { toggleTheme } = useThemeContext();
  const section = findNavItem(pathname);

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
        <IconButton label="Переключить тему" onClick={toggleTheme}>
          <Sun size={20} className="sun-icon" />
          <Moon size={20} className="moon-icon" />
        </IconButton>
        <Link to="/account" className="topbar-avatar" aria-label="Аккаунт" title="Аккаунт">
          <UserRound size={18} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
