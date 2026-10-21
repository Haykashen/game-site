import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useGameCollection } from '../hooks/useGameCollection';
import type { GameCollection } from '../hooks/useGameCollection';

const CollectionContext = createContext<GameCollection | null>(null);

/**
 * One catalogue/collection store for every route: the sidebar badge, catalogue,
 * collection page and detail drawer all read the same state.
 */
export function CollectionProvider({ children }: { children: ReactNode }) {
  const value = useGameCollection();

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection(): GameCollection {
  const context = useContext(CollectionContext);

  if (!context) {
    throw new Error('useCollection must be used inside CollectionProvider.');
  }

  return context;
}
