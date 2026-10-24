import type { FastifyInstance } from 'fastify';
import {
  gameSubscriptionUpdateSchema,
  notificationListQuerySchema,
  notificationParamsSchema,
  paginated,
  subscriptionEntryParamsSchema,
  subscriptionGameParamsSchema,
  type GameSubscriptionDto,
  type NotificationReadAllResponse,
  type NotificationReadResponse,
  type SubscriptionListDto,
} from '@discvault/shared';
import { notFound, unauthorized } from '../errors.js';
import {
  gameSubscriptionInclude,
  marketEntrySubscriptionInclude,
  notificationInclude,
  serializeGameSubscription,
  serializeMarketEntrySubscription,
  serializeNotification,
} from '../lib/serializers.js';
import { parse } from '../lib/validation.js';

function currentUserId(request: { user: { id: string } | null }): string {
  if (!request.user) throw unauthorized();
  return request.user.id;
}

export function registerNotificationRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/notifications/unread-count',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = currentUserId(request);
      const unreadCount = await app.prisma.notification.count({
        where: { userId, readAt: null },
      });

      return reply.send({ unreadCount });
    },
  );

  app.get(
    '/api/v1/notifications',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = currentUserId(request);
      const query = parse(notificationListQuerySchema, request.query);
      const where = {
        userId,
        ...(query.status === 'unread' ? { readAt: null } : {}),
      };

      const [total, notifications] = await app.prisma.$transaction([
        app.prisma.notification.count({ where }),
        app.prisma.notification.findMany({
          where,
          include: notificationInclude,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);

      return reply.send(
        paginated(
          notifications.map(serializeNotification),
          total,
          query.page,
          query.pageSize,
        ),
      );
    },
  );

  app.patch(
    '/api/v1/notifications/read-all',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = currentUserId(request);
      const result = await app.prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      });
      const body: NotificationReadAllResponse = {
        updated: result.count,
        unreadCount: 0,
      };

      return reply.send(body);
    },
  );

  app.patch(
    '/api/v1/notifications/:id/read',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = currentUserId(request);
      const { id } = parse(notificationParamsSchema, request.params);

      await app.prisma.notification.updateMany({
        where: { id, userId, readAt: null },
        data: { readAt: new Date() },
      });

      const notification = await app.prisma.notification.findFirst({
        where: { id, userId },
        include: notificationInclude,
      });

      if (!notification) throw notFound('Уведомление не найдено.');

      const unreadCount = await app.prisma.notification.count({
        where: { userId, readAt: null },
      });
      const body: NotificationReadResponse = {
        notification: serializeNotification(notification),
        unreadCount,
      };

      return reply.send(body);
    },
  );

  app.get(
    '/api/v1/subscriptions',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = currentUserId(request);
      const [games, entries] = await app.prisma.$transaction([
        app.prisma.gameSubscription.findMany({
          where: { userId },
          include: gameSubscriptionInclude,
          orderBy: { createdAt: 'desc' },
        }),
        app.prisma.marketEntrySubscription.findMany({
          where: { userId, marketEntry: { deletedAt: null } },
          include: marketEntrySubscriptionInclude,
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      const body: SubscriptionListDto = {
        games: games.map(serializeGameSubscription),
        entries: entries.map(serializeMarketEntrySubscription),
      };

      return reply.send(body);
    },
  );

  app.put(
    '/api/v1/subscriptions/games/:gameId',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = currentUserId(request);
      const { gameId } = parse(subscriptionGameParamsSchema, request.params);
      const input = parse(gameSubscriptionUpdateSchema, request.body ?? {});

      const game = await app.prisma.game.findUnique({
        where: { id: gameId },
        select: { id: true },
      });

      if (!game) throw notFound('Игра не найдена.');

      const subscription = await app.prisma.gameSubscription.upsert({
        where: { userId_gameId: { userId, gameId } },
        create: {
          userId,
          gameId,
          notifyAuctions: input.notifyAuctions ?? true,
          notifyListings: input.notifyListings ?? true,
        },
        update: {
          ...(input.notifyAuctions !== undefined
            ? { notifyAuctions: input.notifyAuctions }
            : {}),
          ...(input.notifyListings !== undefined
            ? { notifyListings: input.notifyListings }
            : {}),
        },
        include: gameSubscriptionInclude,
      });

      const body: GameSubscriptionDto = serializeGameSubscription(subscription);
      return reply.send(body);
    },
  );

  app.delete(
    '/api/v1/subscriptions/games/:gameId',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = currentUserId(request);
      const { gameId } = parse(subscriptionGameParamsSchema, request.params);

      await app.prisma.gameSubscription.deleteMany({
        where: { userId, gameId },
      });

      return reply.code(204).send();
    },
  );

  app.put(
    '/api/v1/subscriptions/market/:entryId',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = currentUserId(request);
      const { entryId } = parse(subscriptionEntryParamsSchema, request.params);

      const entry = await app.prisma.marketEntry.findFirst({
        where: { id: entryId, deletedAt: null, moderationStatus: 'visible' },
        select: { id: true },
      });

      if (!entry) throw notFound('Объявление не найдено.');

      const subscription = await app.prisma.marketEntrySubscription.upsert({
        where: {
          userId_marketEntryId: { userId, marketEntryId: entryId },
        },
        create: { userId, marketEntryId: entryId },
        update: {},
        include: marketEntrySubscriptionInclude,
      });

      return reply.send(serializeMarketEntrySubscription(subscription));
    },
  );

  app.delete(
    '/api/v1/subscriptions/market/:entryId',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = currentUserId(request);
      const { entryId } = parse(subscriptionEntryParamsSchema, request.params);

      await app.prisma.marketEntrySubscription.deleteMany({
        where: { userId, marketEntryId: entryId },
      });

      return reply.code(204).send();
    },
  );
}
