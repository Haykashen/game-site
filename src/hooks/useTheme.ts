import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../lib/constants';
import type { Theme } from '../types';

function readInitialTheme(): Theme {
  // index.html sets the class before paint, so this is always in sync.
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch {
      // Persisting the theme is a nice-to-have, not a requirement.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggleTheme };
}
