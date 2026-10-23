import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import {
  paginated,
  paginationSchema,
  updateProfileSchema,
  type PublicProfile,
  type UpdateProfileInput,
} from '@retrokeep/shared';
import { notFound, unauthorized } from '../errors.js';
import { isPrismaError } from '../lib/prismaErrors.js';
import { storePhotoReference } from '../lib/storage.js';
import { parse } from '../lib/validation.js';
import {
  getUserProfile,
  reviewInclude,
  serializePublicUser,
  serializeReview,
  userSelect,
} from '../lib/serializers.js';

const publicProfileSelect = {
  ...userSelect,
  city: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export function registerUserRoutes(app: FastifyInstance): void {
  app.patch(
    '/api/v1/users/me',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const sessionUser = request.user;
      if (!sessionUser) throw unauthorized();

      const input = parse(updateProfileSchema, request.body);
      const data: UpdateProfileInput = { ...input };

      if (input.avatarUrl !== undefined) {
        data.avatarUrl =
          input.avatarUrl === null
            ? null
            : await storePhotoReference(input.avatarUrl, 'avatars');
      }

      const user = await app.prisma.user
        .update({
          where: { id: sessionUser.id },
          data: {
            ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
            ...(data.phone !== undefined ? { phone: data.phone } : {}),
            ...(data.city !== undefined ? { city: data.city } : {}),
            ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
          },
        })
        .catch((error: unknown) => {
          if (isPrismaError(error, 'P2025')) return null;
          throw error;
        });

      if (!user) throw notFound('Пользователь не найден.');

      return reply.send({ user: await getUserProfile(app.prisma, user) });
    },
  );

  app.get('/api/v1/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await app.prisma.user.findFirst({
      where: { id, status: 'active' },
      select: publicProfileSelect,
    });

    if (!user) throw notFound('Пользователь не найден.');

    const dealsCompleted = await app.prisma.deal.count({
      where: {
        status: 'completed',
        OR: [{ buyerId: id }, { sellerId: id }],
      },
    });

    const profile: PublicProfile = {
      ...serializePublicUser(user),
      city: user.city,
      dealsCompleted,
      memberSince: user.createdAt.toISOString(),
    };

    return reply.send(profile);
  });

  app.get('/api/v1/users/:id/reviews', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = parse(paginationSchema, request.query);

    const user = await app.prisma.user.findFirst({
      where: { id, status: 'active' },
      select: { id: true },
    });

    if (!user) throw notFound('Пользователь не найден.');

    const [total, reviews] = await app.prisma.$transaction([
      app.prisma.review.count({ where: { targetId: id } }),
      app.prisma.review.findMany({
        where: { targetId: id },
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return reply.send(
      paginated(reviews.map(serializeReview), total, query.page, query.pageSize),
    );
  });
}
