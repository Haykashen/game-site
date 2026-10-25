import type { PublicProfile } from '@discvault/shared';
import { INITIAL_MARKET_ENTRIES } from '../data';
import { DISCUSSIONS } from '../data/discussions';
import { NEWS_POSTS } from '../data/news';

const DEMO_PREFIX = 'demo:';

export function demoProfileId(name: string): string {
  return `${DEMO_PREFIX}${name}`;
}

/** Demo identities are resolved only from bundled public content. */
export function getDemoProfile(id: string): PublicProfile | null {
  if (!id.startsWith(DEMO_PREFIX)) return null;
  const name = id.slice(DEMO_PREFIX.length);
  const known = INITIAL_MARKET_ENTRIES.some((entry) => entry.seller === name)
    || DISCUSSIONS.some((topic) => topic.author === name || topic.comments.some((comment) => comment.author === name))
    || NEWS_POSTS.some((post) => post.author === name);
  if (!known) return null;
  return {
    id, displayName: name, avatarUrl: null, isDemo: true,
    city: INITIAL_MARKET_ENTRIES.find((entry) => entry.seller === name)?.shipsFrom || null,
    rating: null, reviewCount: 0, dealsCompleted: 0, memberSince: '',
  };
}
