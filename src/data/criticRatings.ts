export interface CriticRating {
  score: number;
  platform: string;
  url: string;
  checkedAt: string;
}

/** Verified snapshots of critic Metascores, never user scores or live API data. */
export const CRITIC_RATINGS: Readonly<Record<string, CriticRating>> = {
  'silent-hill-2': {
    score: 89, platform: 'PlayStation 2',
    url: 'https://www.metacritic.com/game/silent-hill-2-2001/', checkedAt: '2026-10-25',
  },
  'halo-combat': {
    score: 97, platform: 'Xbox',
    url: 'https://www.metacritic.com/game/halo-combat-evolved/', checkedAt: '2026-10-25',
  },
  'elden-ring': {
    score: 96, platform: 'PlayStation 5',
    url: 'https://www.metacritic.com/game/elden-ring/?platform=playstation-5', checkedAt: '2026-10-25',
  },
};
