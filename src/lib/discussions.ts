import { DISCUSSIONS } from '../data/discussions';
import type { Discussion } from '../types';

/**
 * The pinned topic is the game's main conversation; fall back to the first
 * topic so a game without a pin still opens something useful.
 */
export function primaryDiscussionForGame(gameId: string): Discussion | undefined {
  return (
    DISCUSSIONS.find((discussion) => discussion.gameId === gameId && discussion.pinned) ??
    DISCUSSIONS.find((discussion) => discussion.gameId === gameId)
  );
}

/** Canonical URL that opens a game discussion card and keeps the game filter. */
export function discussionRoutePath(gameId: string, discussionId?: string): string {
  const params = new URLSearchParams({ game: gameId });
  const targetId = discussionId ?? primaryDiscussionForGame(gameId)?.id;

  if (targetId) params.set('item', targetId);

  return `/discussions?${params.toString()}`;
}
