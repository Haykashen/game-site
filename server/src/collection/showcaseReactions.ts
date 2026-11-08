import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {paginationSchema, paginated, showcaseCommentSchema} from '@discvault/shared';
import {notFound, unauthorized} from '../errors.js';
import {parse} from '../lib/validation.js';
import {ratingFrom} from '../lib/rating.js';
const params = z.object({id: z.string().uuid()});
const commentParams = params.extend({commentId: z.string().uuid()});
export function registerShowcaseReactions(app: FastifyInstance) {
  async function visible(id: string) {
    const share = await app.prisma.copyShare.findFirst({where: {id, copy: {user: {statusReference: {code: 'active'}}}}, select: {id: true}});
    if (!share) throw notFound('Публикация не найдена.');
  }
  async function social(id: string, userId?: string) {
    const [likesCount, commentsCount, like] = await Promise.all([
      app.prisma.copyShareLike.count({where: {shareId: id}}),
      app.prisma.copyShareComment.count({where: {shareId: id}}),
      userId ? app.prisma.copyShareLike.findUnique({where: {shareId_userId: {shareId: id, userId}}}) : null,
    ]);
    return {likesCount, commentsCount, likedByMe: Boolean(like)};
  }
  app.get('/api/v1/community/showcase/:id/social', {preHandler: app.optionalAuth}, async request => {
    const {id} = parse(params, request.params); await visible(id); return social(id, request.user?.id);
  });
  for (const method of ['PUT', 'DELETE'] as const) app.route({method, url: '/api/v1/community/showcase/:id/like', preHandler: app.authenticate, handler: async request => {
    if (!request.user) throw unauthorized();
    const {id} = parse(params, request.params); await visible(id);
    const key = {shareId: id, userId: request.user.id};
    if (method === 'PUT') await app.prisma.copyShareLike.upsert({where: {shareId_userId: key}, create: key, update: {}});
    else await app.prisma.copyShareLike.deleteMany({where: key});
    return social(id, request.user.id);
  }});
  app.get('/api/v1/community/showcase/:id/comments', async request => {
    const {id} = parse(params, request.params); await visible(id);
    const {page, pageSize} = parse(paginationSchema, request.query);
    const where = {shareId: id};
    const [rows, total] = await app.prisma.$transaction([
      app.prisma.copyShareComment.findMany({where, orderBy: [{createdAt: 'asc'}, {id: 'asc'}], skip: (page - 1) * pageSize, take: pageSize, include: {user: {select: {id: true, displayName: true, ratingSum: true, ratingCount: true}}}}),
      app.prisma.copyShareComment.count({where}),
    ]);
    return paginated(rows.map(row => ({id: row.id, body: row.body, createdAt: row.createdAt.toISOString(), author: {id: row.user.id, displayName: row.user.displayName, rating: ratingFrom(row.user.ratingSum, row.user.ratingCount)}})), total, page, pageSize);
  });
  app.post('/api/v1/community/showcase/:id/comments', {preHandler: app.authenticate, config: {rateLimit: {max: 10, timeWindow: '1 minute'}}}, async (request, reply) => {
    if (!request.user) throw unauthorized();
    const {id} = parse(params, request.params); const {body} = parse(showcaseCommentSchema, request.body); await visible(id);
    await app.prisma.copyShareComment.create({data: {shareId: id, userId: request.user.id, body}});
    return reply.code(201).send(await social(id, request.user.id));
  });
  app.delete('/api/v1/community/showcase/:id/comments/:commentId', {preHandler: app.authenticate}, async (request, reply) => {
    if (!request.user) throw unauthorized();
    const {id, commentId} = parse(commentParams, request.params); await visible(id);
    const moderator = request.user.role === 'admin' || request.user.role === 'moderator';
    const result = await app.prisma.copyShareComment.deleteMany({where: {id: commentId, shareId: id, ...(!moderator ? {userId: request.user.id} : {})}});
    if (!result.count) throw notFound('Комментарий не найден.');
    return reply.send(await social(id, request.user.id));
  });
}
