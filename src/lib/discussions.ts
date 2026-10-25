import { DISCUSSIONS } from '../data/discussions';
import type { Discussion, DiscussionComment } from '../types';

/**
 * The pinned topic is the game's main conversation; fall back to the first
 * topic so a game without a pin still opens something useful.
 */
export function primaryDiscussionForGame(
  gameId: string,
  discussions: readonly Discussion[] = DISCUSSIONS,
): Discussion | undefined {
  return (
    discussions.find((discussion) => discussion.gameId === gameId && discussion.pinned) ??
    discussions.find((discussion) => discussion.gameId === gameId)
  );
}

/** Canonical URL that opens a game discussion card and keeps the game filter. */
export function discussionRoutePath(
  gameId: string,
  discussionId?: string,
  discussions?: readonly Discussion[],
): string {
  const params = new URLSearchParams({ game: gameId });
  const targetId =
    discussionId ?? primaryDiscussionForGame(gameId, discussions)?.id;

  if (targetId) params.set('item', targetId);

  return `/discussions?${params.toString()}`;
}

/** Flattens an arbitrary-depth API thread into a single list. */
export function flattenDiscussionComments(
  comments: readonly DiscussionComment[],
): DiscussionComment[] {
  const flat: DiscussionComment[] = [];

  const visit = (items: readonly DiscussionComment[]) => {
    for (const comment of items) {
      flat.push(comment);
      if (comment.replies && comment.replies.length > 0) visit(comment.replies);
    }
  };

  visit(comments);
  return flat;
}

/**
 * Builds a renderable tree from either flat demo data or nested API replies.
 * A reply whose parent is missing is kept as a root so no message is lost.
 */
export function buildDiscussionReplyTree(
  comments: readonly DiscussionComment[],
): DiscussionComment[] {
  const flat = flattenDiscussionComments(comments);
  const byId = new Map<string, DiscussionComment>();

  for (const comment of flat) {
    byId.set(comment.id, { ...comment, replies: [] });
  }

  const roots: DiscussionComment[] = [];

  for (const comment of flat) {
    const node = byId.get(comment.id);

    if (!node) continue;

    const parent = comment.parentId ? byId.get(comment.parentId) : undefined;

    if (parent) {
      parent.replies = [...(parent.replies ?? []), node];
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Counts every reply at every nesting level. */
export function countDiscussionReplies(
  comments: readonly DiscussionComment[],
): number {
  return flattenDiscussionComments(comments).length;
}

/** API summaries carry an exact total; demo threads are counted locally. */
export function discussionReplyCount(discussion: Discussion): number {
  return discussion.commentCount ?? countDiscussionReplies(discussion.comments);
}
