import type { Prisma } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  discussionCommentCreateSchema,
  discussionCommentUpdateSchema,
  discussionCreateSchema,
  discussionListQuerySchema,
  discussionUpdateSchema,
  paginated,
  type DiscussionReplyResponse,
  type DiscussionSort,
} from '@discvault/shared';
import { forbidden, notFound, unauthorized } from '../errors.js';
import { hasRole } from '../auth/authorization.js';
import {
  discussionDetailInclude,
  discussionListInclude,
  serializeDiscussionComment,
  serializeDiscussionDetail,
  serializeDiscussionSummary,
  userSelect,
} from '../lib/serializers.js';
import { parse } from '../lib/validation.js';

const COMMENT_RATE_LIMIT = {
  max: 30,
  timeWindow: '10 minutes',
} as const;

function discussionOrderBy(
  sort: DiscussionSort,
): Prisma.DiscussionOrderByWithRelationInput[] {
  switch (sort) {
    case 'newest':
      return [{ pinned: 'desc' }, { createdAt: 'desc' }];
    case 'oldest':
      return [{ pinned: 'desc' }, { createdAt: 'asc' }];
    case 'views':
      return [{ pinned: 'desc' }, { views: 'desc' }, { updatedAt: 'desc' }];
    case 'recent':
    default:
      return [{ pinned: 'desc' }, { updatedAt: 'desc' }];
  }
}

function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();

  return tags
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLocaleLowerCase('ru-RU');

      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function deriveExcerpt(body: string): string {
  const normalized = body.replace(/\s+/g, ' ').trim();

  if (normalized.length <= 220) return normalized;
  return `${normalized.slice(0, 217).trimEnd()}…`;
}

function canManageDiscussion(
  request: FastifyRequest,
  authorId: string,
): boolean {
  return Boolean(
    request.user &&
      (request.user.id === authorId ||
        hasRole(request.user, ['moderator', 'admin'])),
  );
}

async function assertGameExists(app: FastifyInstance, gameId: string): Promise<void> {
  const game = await app.prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true },
  });

  if (!game) throw notFound('Игра не найдена.');
}

export function registerDiscussionRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/discussions',
    { preHandler: app.optionalAuth },
    async (request, reply) => {
      const query = parse(discussionListQuerySchema, request.query);
      const and: Prisma.DiscussionWhereInput[] = [];

      if (query.gameId) and.push({ gameId: query.gameId });

      if (query.q) {
        const q = query.q;
        and.push({
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { excerpt: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } },
            { tags: { has: q } },
            { author: { displayName: { contains: q, mode: 'insensitive' } } },
            { game: { title: { contains: q, mode: 'insensitive' } } },
          ],
        });
      }

      const where: Prisma.DiscussionWhereInput =
        and.length > 0 ? { AND: and } : {};
      const skip = (query.page - 1) * query.pageSize;

      const [total, discussions] = await app.prisma.$transaction([
        app.prisma.discussion.count({ where }),
        app.prisma.discussion.findMany({
          where,
          include: discussionListInclude,
          orderBy: discussionOrderBy(query.sort),
          skip,
          take: query.pageSize,
        }),
      ]);

      return reply.send(
        paginated(
          discussions.map(serializeDiscussionSummary),
          total,
          query.page,
          query.pageSize,
        ),
      );
    },
  );

  app.get(
    '/api/v1/discussions/:id',
    { preHandler: app.optionalAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const discussion = await app.prisma.discussion.findUnique({
        where: { id },
        include: discussionDetailInclude,
      });

      if (!discussion) throw notFound('Обсуждение не найдено.');

      return reply.send(serializeDiscussionDetail(discussion));
    },
  );

  app.post(
    '/api/v1/discussions',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;

      if (!user) throw unauthorized();

      const input = parse(discussionCreateSchema, request.body);
      await assertGameExists(app, input.gameId);

      const discussion = await app.prisma.discussion.create({
        data: {
          authorId: user.id,
          gameId: input.gameId,
          title: input.title,
          excerpt: input.excerpt?.trim() || deriveExcerpt(input.body),
          body: input.body,
          tags: normalizeTags(input.tags),
        },
        include: discussionListInclude,
      });

      return reply.code(201).send(serializeDiscussionSummary(discussion));
    },
  );

  app.patch(
    '/api/v1/discussions/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;

      if (!user) throw unauthorized();

      const { id } = request.params as { id: string };
      const input = parse(discussionUpdateSchema, request.body);
      const existing = await app.prisma.discussion.findUnique({
        where: { id },
        select: { authorId: true, body: true },
      });

      if (!existing) throw notFound('Обсуждение не найдено.');
      if (!canManageDiscussion(request, existing.authorId)) {
        throw forbidden('Нельзя изменять чужое обсуждение.');
      }
      if (input.pinned !== undefined && !hasRole(user, ['moderator', 'admin'])) {
        throw forbidden('Закреплять темы может только модератор.');
      }

      const discussion = await app.prisma.discussion.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.excerpt !== undefined
            ? {
                excerpt:
                  input.excerpt.trim() ||
                  deriveExcerpt(input.body ?? existing.body),
              }
            : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.tags !== undefined ? { tags: normalizeTags(input.tags) } : {}),
          ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
        },
        include: discussionListInclude,
      });

      return reply.send(serializeDiscussionSummary(discussion));
    },
  );

  app.delete(
    '/api/v1/discussions/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await app.prisma.discussion.findUnique({
        where: { id },
        select: { authorId: true },
      });

      if (!existing) throw notFound('Обсуждение не найдено.');
      if (!canManageDiscussion(request, existing.authorId)) {
        throw forbidden('Нельзя удалить чужое обсуждение.');
      }

      await app.prisma.discussion.delete({ where: { id } });
      return reply.code(204).send();
    },
  );

  app.post(
    '/api/v1/discussions/:id/comments',
    {
      preHandler: app.authenticate,
      config: { rateLimit: COMMENT_RATE_LIMIT },
    },
    async (request, reply) => {
      const user = request.user;

      if (!user) throw unauthorized();

      const { id } = request.params as { id: string };
      const input = parse(discussionCommentCreateSchema, request.body);
      const discussion = await app.prisma.discussion.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!discussion) throw notFound('Обсуждение не найдено.');

      if (input.parentId) {
        const parent = await app.prisma.discussionComment.findFirst({
          where: { id: input.parentId, discussionId: id },
          select: { id: true },
        });

        if (!parent) {
          throw notFound('Сообщение, на которое вы отвечаете, не найдено.');
        }
      }

      const result = await app.prisma.$transaction(async (tx) => {
        const comment = await tx.discussionComment.create({
          data: {
            discussionId: id,
            authorId: user.id,
            parentId: input.parentId ?? null,
            body: input.body,
          },
          include: { author: { select: userSelect } },
        });
        const updated = await tx.discussion.update({
          where: { id },
          data: { updatedAt: new Date() },
          select: { updatedAt: true },
        });
        const commentCount = await tx.discussionComment.count({
          where: { discussionId: id },
        });

        return {
          comment,
          commentCount,
          updatedAt: updated.updatedAt,
        };
      });

      const body: DiscussionReplyResponse = {
        comment: serializeDiscussionComment(result.comment),
        commentCount: result.commentCount,
        updatedAt: result.updatedAt.toISOString(),
      };

      return reply.code(201).send(body);
    },
  );

  app.patch(
    '/api/v1/discussions/:id/comments/:commentId',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;

      if (!user) throw unauthorized();

      const { id, commentId } = request.params as {
        id: string;
        commentId: string;
      };
      const input = parse(discussionCommentUpdateSchema, request.body);
      const comment = await app.prisma.discussionComment.findFirst({
        where: { id: commentId, discussionId: id },
        include: {
          author: { select: userSelect },
          discussion: { select: { authorId: true } },
        },
      });

      if (!comment) throw notFound('Ответ не найден.');

      if (
        comment.authorId !== user.id &&
        comment.discussion.authorId !== user.id &&
        !hasRole(user, ['moderator', 'admin'])
      ) {
        throw forbidden('Нельзя изменять чужой ответ.');
      }

      const updated = await app.prisma.discussionComment.update({
        where: { id: commentId },
        data: { body: input.body },
        include: { author: { select: userSelect } },
      });

      return reply.send(serializeDiscussionComment(updated));
    },
  );

  app.delete(
    '/api/v1/discussions/:id/comments/:commentId',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;

      if (!user) throw unauthorized();

      const { id, commentId } = request.params as {
        id: string;
        commentId: string;
      };
      const comment = await app.prisma.discussionComment.findFirst({
        where: { id: commentId, discussionId: id },
        include: { discussion: { select: { authorId: true } } },
      });

      if (!comment) throw notFound('Ответ не найден.');

      if (
        comment.authorId !== user.id &&
        comment.discussion.authorId !== user.id &&
        !hasRole(user, ['moderator', 'admin'])
      ) {
        throw forbidden('Нельзя удалить чужой ответ.');
      }

      await app.prisma.$transaction([
        app.prisma.discussionComment.delete({ where: { id: commentId } }),
        app.prisma.discussion.update({
          where: { id },
          data: { updatedAt: new Date() },
        }),
      ]);

      return reply.code(204).send();
    },
  );
}
