import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { gameRatingParamsSchema, gameRatingSchema, type GameRatingSummary } from '@discvault/shared';
import { notFound, unauthorized } from '../errors.js';
import { parse } from '../lib/validation.js';

async function summary(tx: Prisma.TransactionClient, gameId: string, userId?: string): Promise<GameRatingSummary> {
  const [aggregate, own] = await Promise.all([
    tx.gameRating.aggregate({ where: { gameId, user: { status: 'active' } }, _avg: { score: true }, _count: { score: true } }),
    userId ? tx.gameRating.findUnique({ where: { userId_gameId: { userId, gameId } } }) : null,
  ]);
  return { average: aggregate._avg.score, count: aggregate._count.score, myScore: own?.score ?? null };
}

export function registerGameRatingRoutes(app: FastifyInstance): void {
  const path = '/api/v1/catalog/games/:id/ratings';

  app.get(path, { preHandler: app.optionalAuth }, async (request) => {
    const { id } = parse(gameRatingParamsSchema, request.params);
    return app.prisma.$transaction(async (tx) => {
      if (!await tx.game.findUnique({ where: { id }, select: { id: true } })) throw notFound('Игра не найдена.');
      return summary(tx, id, request.user?.id);
    }, { isolationLevel: 'RepeatableRead' });
  });

  app.put(path, { preHandler: app.authenticate }, async (request) => {
    const userId = request.user?.id;
    if (!userId) throw unauthorized();
    const { id } = parse(gameRatingParamsSchema, request.params);
    const { score } = parse(gameRatingSchema, request.body);
    return app.prisma.$transaction(async (tx) => {
      if (!await tx.game.findUnique({ where: { id }, select: { id: true } })) throw notFound('Игра не найдена.');
      await tx.gameRating.upsert({ where: { userId_gameId: { userId, gameId: id } }, create: { userId, gameId: id, score }, update: { score } });
      return summary(tx, id, userId);
    });
  });

  app.delete(path, { preHandler: app.authenticate }, async (request) => {
    const userId = request.user?.id;
    if (!userId) throw unauthorized();
    const { id } = parse(gameRatingParamsSchema, request.params);
    return app.prisma.$transaction(async (tx) => {
      if (!await tx.game.findUnique({ where: { id }, select: { id: true } })) throw notFound('Игра не найдена.');
      await tx.gameRating.deleteMany({ where: { userId, gameId: id } });
      return summary(tx, id, userId);
    });
  });
}
