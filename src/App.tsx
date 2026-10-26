import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { AuthProvider } from './context/AuthContext';
import { CollectionProvider } from './context/CollectionContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { ThemeProvider } from './context/ThemeContext';
import { AccountPage } from './pages/AccountPage';
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage';
import { AdminReportsPage } from './pages/AdminReportsPage';
import { AuctionsPage } from './pages/AuctionsPage';
import { CollectionPage } from './pages/CollectionPage';
import { DiscussionsPage } from './pages/DiscussionsPage';
import { GamesPage } from './pages/GamesPage';
import { ListingsPage } from './pages/ListingsPage';
import { NewsPage } from './pages/NewsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { UserProfilePage } from './pages/UserProfilePage';

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificationsProvider>
            <CollectionProvider>
              <AppShell>
                <Routes>
                  <Route path="/" element={<Navigate to="/games" replace />} />
                  <Route path="/games" element={<GamesPage />} />
                  <Route path="/auctions" element={<AuctionsPage />} />
                  <Route path="/listings" element={<ListingsPage />} />
                  <Route
                    path="/listings/sales"
                    element={<ListingsPage listingType="sale" />}
                  />
                  <Route
                    path="/listings/purchases"
                    element={<ListingsPage listingType="purchase" />}
                  />
                  <Route
                    path="/listings/exchange"
                    element={<ListingsPage listingType="exchange" />}
                  />
                  <Route path="/discussions" element={<DiscussionsPage />} />
                  <Route path="/news" element={<NewsPage />} />
                  <Route path="/collection" element={<CollectionPage />} />
                  <Route path="/stats" element={<StatsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/account" element={<AccountPage />} />
                  <Route path="/users/:id" element={<UserProfilePage />} />
                  <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
                  <Route path="/admin/reports" element={<AdminReportsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/games" replace />} />
                </Routes>
              </AppShell>
            </CollectionProvider>
          </NotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
