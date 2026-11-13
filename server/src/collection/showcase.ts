import {ratingFrom} from '../lib/rating.js';
import type {FastifyInstance} from 'fastify';
import type {Prisma} from '@prisma/client';
import {shareCopySchema, paginationSchema, paginated, type CopyShareDto} from '@discvault/shared';
import {badRequest, notFound, unauthorized} from '../errors.js';
import {parse} from '../lib/validation.js';
const include = {_count: {select: {likes: true, comments: true}}, copy: {include: {user: {select: {id: true, displayName: true, ratingSum: true, ratingCount: true}}, edition: {include: {game: {select: {id: true, title: true}}}}}}} satisfies Prisma.CopyShareInclude;
type Share = Prisma.CopyShareGetPayload<{include: typeof include}>;
/** Whitelist public fields: never spread the private copy or user record into the feed. */
export function publicCopyShare(share: Share, likedByMe = false): CopyShareDto {
  const {copy} = share;
  return {likesCount: share._count?.likes ?? 0, commentsCount: share._count?.comments ?? 0, likedByMe, id: share.id, topic: share.topic, caption: share.caption, photos: share.photos, condition: share.condition, completeness: share.completeness, region: share.region, createdAt: share.createdAt.toISOString(), author: {id: copy.user.id, displayName: copy.user.displayName, rating: ratingFrom(copy.user.ratingSum, copy.user.ratingCount)}, game: {id: copy.edition.game.id, title: copy.edition.game.title}, edition: {id: copy.edition.id, name: copy.edition.name, platform: copy.edition.platform}};
}
export function registerShowcaseRoutes(app: FastifyInstance) {
  app.get('/api/v1/community/showcase', {preHandler: app.optionalAuth}, async request => {
    const {page, pageSize} = parse(paginationSchema, request.query);
    const where = {copy: {user: {statusReference: {code: 'active'}}}};
    const [rows, total] = await app.prisma.$transaction([
      app.prisma.copyShare.findMany({where, include: {...include, likes: {where: {userId: request.user?.id ?? '00000000-0000-0000-0000-000000000000'}, select: {userId: true}}}, orderBy: [{createdAt: 'desc'}, {id: 'desc'}], skip: (page - 1) * pageSize, take: pageSize}),
      app.prisma.copyShare.count({where}),
    ]);
    return paginated(rows.map(row => publicCopyShare(row, row.likes.length > 0)), total, page, pageSize);
  });
  app.post('/api/v1/community/showcase', {preHandler: app.authenticate}, async (request, reply) => {
    if (!request.user) throw unauthorized();
    const input = parse(shareCopySchema, request.body);
    const copy = await app.prisma.copy.findFirst({where: {id: input.copyId, userId: request.user.id}, include: {photos: {orderBy: {sortOrder: 'asc'}}, edition: {include: {region: true}}}});
    if (!copy) throw notFound('Экземпляр не найден в вашей коллекции.');
    const photos = copy.useEditionCover ? copy.edition.coverImages : copy.photos.map(photo => photo.url);
    if (!photos.length) throw badRequest('Добавьте к экземпляру хотя бы одну фотографию.');
    // Public photos are a snapshot: later private edits must not publish new images silently.
    const data = {topic: input.topic, caption: input.caption, photos: [...photos], condition: copy.condition, completeness: copy.completeness, region: copy.region ?? copy.edition.region.code};
    const share = await app.prisma.copyShare.upsert({where: {copyId: copy.id}, create: {copyId: copy.id, ...data}, update: data, include});
    return reply.code(201).send(publicCopyShare(share));
  });
  app.delete('/api/v1/community/showcase/:id', {preHandler: app.authenticate}, async (request, reply) => {
    if (!request.user) throw unauthorized();
    const result = await app.prisma.copyShare.deleteMany({where: {id: (request.params as {id: string}).id, copy: {userId: request.user.id}}});
    if (!result.count) throw notFound('Публикация не найдена.');
    return reply.code(204).send();
  });
}
