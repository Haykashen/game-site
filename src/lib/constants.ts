export const STORAGE_KEYS = {
  games: 'retrokeep_games',
  owned: 'retrokeep_owned',
  market: 'retrokeep_market',
  theme: 'theme',
} as const;

export const MODAL_TRANSITION_MS = 300;
export const MODAL_ENTER_DELAY_MS = 10;
/** Photos are compressed in the browser; keep the stored payload small. */
export const MAX_MARKET_PHOTOS = 6;
