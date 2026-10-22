import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { AuthProvider } from './context/AuthContext';
import { CollectionProvider } from './context/CollectionContext';
import { ThemeProvider } from './context/ThemeContext';
import { AccountPage } from './pages/AccountPage';
import { AuctionsPage } from './pages/AuctionsPage';
import { CollectionPage } from './pages/CollectionPage';
import { GamesPage } from './pages/GamesPage';
import { ListingsPage } from './pages/ListingsPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <AuthProvider>
          <CollectionProvider>
            <AppShell>
              <Routes>
                <Route path="/" element={<Navigate to="/games" replace />} />
                <Route path="/games" element={<GamesPage />} />
                <Route path="/auctions" element={<AuctionsPage />} />
                <Route path="/listings" element={<ListingsPage />} />
                <Route path="/collection" element={<CollectionPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/games" replace />} />
              </Routes>
            </AppShell>
          </CollectionProvider>
        </AuthProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
