export const STORAGE_KEYS = {
  games: 'discvault_games',
  /** Legacy game-level collection; migrated to `copies` on read. */
  owned: 'discvault_owned',
  copies: 'discvault_copies',
  market: 'discvault_market',
  theme: 'theme',
} as const;

/**
 * Demo-mode data saved before the DiscVault rename. It is copied to the new
 * keys on startup so existing collections and listings are not lost.
 */
const LEGACY_STORAGE_KEYS: Array<[keyof typeof STORAGE_KEYS, string]> = [
  ['games', 'retrokeep_games'],
  ['owned', 'retrokeep_owned'],
  ['copies', 'retrokeep_copies'],
  ['market', 'retrokeep_market'],
];

export function migrateLegacyStorage(): void {
  if (typeof window === 'undefined') return;

  for (const [key, legacyKey] of LEGACY_STORAGE_KEYS) {
    try {
      const legacyValue = window.localStorage.getItem(legacyKey);
      if (legacyValue === null) continue;

      if (window.localStorage.getItem(STORAGE_KEYS[key]) === null) {
        window.localStorage.setItem(STORAGE_KEYS[key], legacyValue);
      }

      window.localStorage.removeItem(legacyKey);
    } catch {
      // Storage can be unavailable in private mode; the app still works.
    }
  }
}

export const MODAL_TRANSITION_MS = 300;
export const MODAL_ENTER_DELAY_MS = 10;
/** Photos are compressed in the browser; keep the stored payload small. */
export const MAX_MARKET_PHOTOS = 6;
/** The collection stepper is intentionally bounded; it is not a stock counter. */
export const MAX_COLLECTION_QUANTITY = 99;
