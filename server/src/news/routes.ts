import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import {
  newsCreateSchema,
  newsListQuerySchema,
  newsUpdateSchema,
  paginated,
} from '@discvault/shared';
import { requireRoles } from '../auth/authorization.js';
import { notFound } from '../errors.js';
import {
  newsPostInclude,
  serializeNewsPost,
} from '../lib/serializers.js';
import { parse } from '../lib/validation.js';

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

  if (normalized.length <= 240) return normalized;
  return `${normalized.slice(0, 237).trimEnd()}…`;
}

async function assertGameExists(
  app: FastifyInstance,
  gameId: string | null | undefined,
): Promise<void> {
  if (!gameId) return;

  const game = await app.prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true },
  });

  if (!game) throw notFound('Игра не найдена.');
}

export function registerNewsRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/news',
    { preHandler: app.optionalAuth },
    async (request, reply) => {
      const query = parse(newsListQuerySchema, request.query);
      const and: Prisma.NewsPostWhereInput[] = [];

      if (query.category) and.push({ category: query.category });
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

      const where: Prisma.NewsPostWhereInput =
        and.length > 0 ? { AND: and } : {};
      const skip = (query.page - 1) * query.pageSize;

      const [total, posts] = await app.prisma.$transaction([
        app.prisma.newsPost.count({ where }),
        app.prisma.newsPost.findMany({
          where,
          include: newsPostInclude,
          orderBy: { publishedAt: query.sort === 'oldest' ? 'asc' : 'desc' },
          skip,
          take: query.pageSize,
        }),
      ]);

      return reply.send(
        paginated(posts.map(serializeNewsPost), total, query.page, query.pageSize),
      );
    },
  );

  app.get(
    '/api/v1/news/:id',
    { preHandler: app.optionalAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const post = await app.prisma.newsPost.findUnique({
        where: { id },
        include: newsPostInclude,
      });

      if (!post) throw notFound('Новость не найдена.');

      return reply.send(serializeNewsPost(post));
    },
  );

  app.post(
    '/api/v1/news',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = requireRoles(request);
      const input = parse(newsCreateSchema, request.body);
      await assertGameExists(app, input.gameId);

      const post = await app.prisma.newsPost.create({
        data: {
          authorId: user.id,
          gameId: input.gameId ?? null,
          title: input.title,
          excerpt: input.excerpt?.trim() || deriveExcerpt(input.body),
          body: input.body,
          category: input.category,
          tags: normalizeTags(input.tags),
          ...(input.publishedAt
            ? { publishedAt: new Date(input.publishedAt) }
            : {}),
        },
        include: newsPostInclude,
      });

      return reply.code(201).send(serializeNewsPost(post));
    },
  );

  app.patch(
    '/api/v1/news/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      requireRoles(request);
      const { id } = request.params as { id: string };
      const input = parse(newsUpdateSchema, request.body);
      const existing = await app.prisma.newsPost.findUnique({
        where: { id },
        select: { id: true, body: true },
      });

      if (!existing) throw notFound('Новость не найдена.');

      await assertGameExists(app, input.gameId);

      const post = await app.prisma.newsPost.update({
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
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.gameId !== undefined ? { gameId: input.gameId } : {}),
          ...(input.tags !== undefined ? { tags: normalizeTags(input.tags) } : {}),
          ...(input.publishedAt !== undefined
            ? { publishedAt: new Date(input.publishedAt) }
            : {}),
        },
        include: newsPostInclude,
      });

      return reply.send(serializeNewsPost(post));
    },
  );

  app.delete(
    '/api/v1/news/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      requireRoles(request);
      const { id } = request.params as { id: string };
      const existing = await app.prisma.newsPost.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) throw notFound('Новость не найдена.');

      await app.prisma.newsPost.delete({ where: { id } });

      return reply.code(204).send();
    },
  );
}
