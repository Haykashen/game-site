import { statusCode, statusWhere, statusWrite, type StatusRecord } from './statusSource.js';
import { z } from 'zod';
import type { FastifyRequest, FastifyInstance } from 'fastify';
import { hasRole, requireRoles } from '../auth/authorization.js';
import { unauthorized, conflict } from '../errors.js';

export function registerCommunitySubmit(app: FastifyInstance, kind: 'news' | 'discussions') {
  app.post('/api/v1/' + kind + '/:id/submit', {preHandler: app.authenticate}, async (request) => {
    if (!request.user) throw unauthorized();
    const {id} = request.params as {id: string};
    const args = {
      where: {id, authorId: request.user.id, ...statusWhere({in: ['draft', 'hidden']})},
      data: {...await statusWrite(app.prisma, kind === 'news' ? 'NewsPost' : 'Discussion', {moderationStatus: 'pending'}), moderationNote: null, moderatedAt: null, moderatorId: null},
    };
    const result = kind === 'news' ? await app.prisma.newsPost.updateMany(args) : await app.prisma.discussion.updateMany(args);
    if (!result.count) throw conflict('SUBMISSION_CHANGED', 'Запись уже отправлена на проверку или недоступна.');
    return {status: 'pending'};
  });
}

export const communityReviewSchema = z.object({
  updatedAt: z.string().datetime(),
  status: z.enum(['visible', 'hidden']),
  note: z.string().trim().max(1000).default(''),
}).refine(value => value.status !== 'hidden' || value.note.length > 0, 'Укажите причину отклонения.');

export function communityScope(request: FastifyRequest, scope: 'public' | 'mine' | 'pending') {
  if (scope === 'pending') {
    requireRoles(request);
    return statusWhere('pending');
  }
  if (scope === 'mine') {
    if (!request.user) throw unauthorized();
    return { authorId: request.user.id };
  }
  return statusWhere('visible');
}

export function canReadCommunity(request: FastifyRequest, post: {authorId: string} & StatusRecord) {
  return statusCode(post) === 'visible' || post.authorId === request.user?.id || hasRole(request.user, ['moderator', 'admin']);
}
