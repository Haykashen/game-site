import { useUnreadChatCount } from '../context/ChatsContext';
import { Ellipsis } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { cx } from '../lib/cx';
import { MOBILE_ITEMS, MOBILE_MORE_ITEMS, MODERATION_NAV_GROUP, ADMINISTRATION_NAV_GROUP } from './navigation';

/** Bottom tab bar with a small "more" sheet for stats, account and settings. */
export function MobileNav() {
  const unreadChats = useUnreadChatCount();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const { isModerator, isAdmin } = useAuth();

  useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

  useEscapeKey(() => setIsMoreOpen(false), isMoreOpen);
  useBodyScrollLock(isMoreOpen);

  const moreGroups = [
    {id: 'more', label: 'Ещё', items: MOBILE_MORE_ITEMS},
    ...(isModerator ? [MODERATION_NAV_GROUP] : []),
    ...(isAdmin ? [ADMINISTRATION_NAV_GROUP] : []),
  ];
  const moreItems = moreGroups.flatMap(group => group.items);
  const isMoreActive = moreItems.some((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));

  return (
    <>
      <div className="mobile-nav" role="navigation" aria-label="Мобильная навигация">
        {MOBILE_ITEMS.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/games'}
              className={({ isActive }) => cx('mobile-nav__item', isActive && 'active')}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{item.shortLabel}</span>
            </NavLink>
          );
        })}

        <button
          type="button"
          className={cx('mobile-nav__item', isMoreActive && 'active')}
          aria-expanded={isMoreOpen}
          aria-controls="mobile-more-sheet"
          onClick={() => setIsMoreOpen((previous) => !previous)}
        >
          <Ellipsis size={20} aria-hidden="true" />
          <span>Ещё</span>
        </button>
      </div>

      {isMoreOpen && (
        <>
          <div className="mobile-sheet-backdrop" aria-hidden="true" onClick={() => setIsMoreOpen(false)} />
          <div
            className="mobile-sheet"
            id="mobile-more-sheet"
            role="navigation"
            aria-label="Дополнительные разделы"
          >
            {moreGroups.map(group => <div key={group.id}>
            <p className="mobile-sheet__label">{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  aria-label={item.id === 'chats' && unreadChats > 0 ? `Чаты: ${unreadChats} непрочитанных сообщений` : item.label}
                  className={({ isActive }) => cx('nav-item', isActive && 'active')}
                  onClick={() => setIsMoreOpen(false)}
                >
                  <span className="nav-item__icon"><Icon size={18} aria-hidden="true" />
                    {item.id === 'chats' && unreadChats > 0 && <span className="nav-icon-badge" aria-hidden="true">{unreadChats > 99 ? '99+' : unreadChats}</span>}
                  </span>
                  <span className="nav-item__label">{item.label}</span>
                </NavLink>
              );
            })}</div>)}
          </div>
        </>
      )}
    </>
  );
}
