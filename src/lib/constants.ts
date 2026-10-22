export const STORAGE_KEYS = {
  games: 'retrokeep_games',
  /** Legacy game-level collection; migrated to `copies` on read. */
  owned: 'retrokeep_owned',
  copies: 'retrokeep_copies',
  market: 'retrokeep_market',
  theme: 'theme',
} as const;

export const MODAL_TRANSITION_MS = 300;
export const MODAL_ENTER_DELAY_MS = 10;
/** Photos are compressed in the browser; keep the stored payload small. */
export const MAX_MARKET_PHOTOS = 6;
/** The collection stepper is intentionally bounded; it is not a stock counter. */
export const MAX_COLLECTION_QUANTITY = 99;
