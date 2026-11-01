import { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import { hasRole, requireRoles } from '../auth/authorization.js';
import { unauthorized } from '../errors.js';

export const communityReviewSchema = z.object({
  updatedAt: z.string().datetime(),
  status: z.enum(['visible', 'hidden']),
  note: z.string().trim().max(1000).default(''),
}).refine(value => value.status !== 'hidden' || value.note.length > 0, 'Укажите причину отклонения.');

export function communityScope(request: FastifyRequest, scope: 'public' | 'mine' | 'pending') {
  if (scope === 'pending') {
    requireRoles(request);
    return { moderationStatus: 'pending' as const };
  }
  if (scope === 'mine') {
    if (!request.user) throw unauthorized();
    return { authorId: request.user.id };
  }
  return { moderationStatus: 'visible' as const };
}

export function canReadCommunity(request: FastifyRequest, post: {authorId: string; moderationStatus: string}) {
  return post.moderationStatus === 'visible' || post.authorId === request.user?.id || hasRole(request.user, ['moderator', 'admin']);
}
