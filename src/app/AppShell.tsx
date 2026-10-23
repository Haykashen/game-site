import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { MobileNav } from './MobileNav';
import { findNavItem } from './navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** Fixed sidebar + sticky utility bar on desktop, bottom tabs on mobile. */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const section = findNavItem(pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const title =
      section?.pageTitle ??
      (pathname.startsWith('/users/') ? 'Профиль коллекционера' : null);
    document.title = title ? `${title} — RetroKeep` : 'RetroKeep';
  }, [pathname, section]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <main className="app-content max-w-7xl">{children}</main>
        <MobileNav />
      </div>
    </div>
  );
}
