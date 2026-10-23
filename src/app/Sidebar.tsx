import { Disc, Settings2, UserRound } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCollection } from '../context/CollectionContext';
import { cx } from '../lib/cx';
import { NAV_GROUPS, NAV_ITEMS } from './navigation';
import type { NavItem, NavSectionId } from './navigation';

interface NavRowProps {
  item: NavItem;
  count: number | undefined;
}

function NavRow({ item, count }: NavRowProps) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end={item.path === '/games'}
      className={({ isActive }) => cx('nav-item', isActive && 'active')}
      title={item.label}
      aria-label={item.label}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="nav-item__label">{item.label}</span>
      {count !== undefined && count > 0 && <span className="nav-badge">{count}</span>}
    </NavLink>
  );
}

/** Desktop navigation: brand, grouped sections and a compact account block. */
export function Sidebar() {
  const { user, isModerator } = useAuth();
  const { ownedCount } = useCollection();
  const badges: Partial<Record<NavSectionId, number>> = { collection: ownedCount };

  return (
    <aside className="app-sidebar">
      <Link to="/games" className="app-sidebar__brand" aria-label="RetroKeep — каталог игр">
        <span className="logo-icon">
          <Disc size={22} className="animate-spin-slow" aria-hidden="true" />
        </span>
        <span className="logo-text">RetroKeep</span>
      </Link>

      <div className="app-sidebar__nav" role="navigation" aria-label="Основная навигация">
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.id}>
            <p className="nav-group__label">{group.label}</p>
            {group.items.map((item) => (
              <NavRow key={item.id} item={item} count={badges[item.id]} />
            ))}
          </div>
        ))}

        {isModerator && (
          <div className="nav-group" key="moderation">
            <p className="nav-group__label">Управление</p>
            <NavRow item={NAV_ITEMS.admin} count={undefined} />
          </div>
        )}
      </div>

      <div className="sidebar-account">
        <Link to="/account" className="sidebar-account__identity">
          <span className="sidebar-account__avatar" aria-hidden="true">
            <UserRound size={18} />
          </span>
          <span className="sidebar-account__meta">
            <span className="sidebar-account__name">{user?.displayName ?? '\u0413\u043e\u0441\u0442\u044c'}</span>
            <span className="sidebar-account__sub">{user ? user.email ?? '\u0430\u043a\u043a\u0430\u0443\u043d\u0442' : '\u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c'}</span>
          </span>
        </Link>
        <Link
          to="/settings"
          className="sidebar-account__settings"
          aria-label="Настройки"
          title="Настройки"
        >
          <Settings2 size={16} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
