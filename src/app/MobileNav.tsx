import { Ellipsis } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { cx } from '../lib/cx';
import { MOBILE_ITEMS, MOBILE_MORE_ITEMS, NAV_ITEMS } from './navigation';

/** Bottom tab bar with a small "more" sheet for stats, account and settings. */
export function MobileNav() {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const { isModerator } = useAuth();

  useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

  useEscapeKey(() => setIsMoreOpen(false), isMoreOpen);
  useBodyScrollLock(isMoreOpen);

  const moreItems = isModerator
    ? [...MOBILE_MORE_ITEMS, NAV_ITEMS.analytics, NAV_ITEMS.admin]
    : MOBILE_MORE_ITEMS;
  const isMoreActive = moreItems.some((item) => pathname === item.path);

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
            <p className="mobile-sheet__label">Ещё</p>
            {moreItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) => cx('nav-item', isActive && 'active')}
                  onClick={() => setIsMoreOpen(false)}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="nav-item__label">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
