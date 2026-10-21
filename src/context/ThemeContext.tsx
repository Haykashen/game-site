import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../types';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Shares one theme instance between the top bar, settings page and shell. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useTheme();

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useThemeContext must be used inside ThemeProvider.');
  }

  return context;
}
