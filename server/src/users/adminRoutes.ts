import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import {
  adminUserStatusSchema,
  adminUsersQuerySchema,
  paginated,
  type AdminUserDto,
  type AdminUsersQuery,
} from '@discvault/shared';
import { requireRoles } from '../auth/authorization.js';
import { badRequest, forbidden, notFound } from '../errors.js';
import { ratingFrom } from '../lib/rating.js';
import { getUserProfile } from '../lib/serializers.js';
import { parse } from '../lib/validation.js';

const adminUserSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  isDemo: true,
  role: true,
  status: true,
  suspendedAt: true,
  comment: true,
  createdAt: true,
  ratingSum: true,
  ratingCount: true,
  _count: {
    select: {
      copies: true,
    },
  },
} satisfies Prisma.UserSelect;

type AdminUserRow = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

function serializeAdminUser(
  user: AdminUserRow,
  listings: number,
  deals: number,
): AdminUserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isDemo: user.isDemo,
    role: user.role,
    status: user.status,
    rating: ratingFrom(user.ratingSum, user.ratingCount),
    reviewCount: user.ratingCount,
    listings,
    deals,
    copies: user._count.copies,
    createdAt: user.createdAt.toISOString(),
    suspendedAt: user.suspendedAt?.toISOString() ?? null,
    comment: user.comment,
  };
}

const roleOrder: Record<AdminUserDto['role'], number> = {
  admin: 0,
  moderator: 1,
  user: 2,
};

const statusOrder: Record<AdminUserDto['status'], number> = {
  active: 0,
  suspended: 1,
  deleted: 2,
};

const userCollator = new Intl.Collator('ru', { sensitivity: 'base' });
const commentCollator = new Intl.Collator('ru', { sensitivity: 'base' });

function compareAdminUsers(
  left: AdminUserDto,
  right: AdminUserDto,
  sortBy: AdminUsersQuery['sortBy'],
): number {
  switch (sortBy) {
    case 'user':
      return (
        userCollator.compare(left.displayName, right.displayName) ||
        userCollator.compare(left.email, right.email)
      );
    case 'role':
      return roleOrder[left.role] - roleOrder[right.role];
    case 'status':
      return statusOrder[left.status] - statusOrder[right.status];
    case 'comment':
      if (left.comment === null && right.comment === null) return 0;
      if (left.comment === null) return 1;
      if (right.comment === null) return -1;
      return commentCollator.compare(left.comment, right.comment);
    case 'listings':
      return left.listings - right.listings;
    case 'deals':
      return left.deals - right.deals;
    case 'copies':
      return left.copies - right.copies;
    case 'rating':
      if (left.rating === null && right.rating === null) return 0;
      if (left.rating === null) return 1;
      if (right.rating === null) return -1;
      return left.rating - right.rating;
    case 'createdAt':
      return Date.parse(left.createdAt) - Date.parse(right.createdAt);
    default:
      return 0;
  }
}

function sortAdminUsers(
  users: AdminUserDto[],
  sortBy: AdminUsersQuery['sortBy'],
  sortDir: AdminUsersQuery['sortDir'],
): AdminUserDto[] {
  const direction = sortDir === 'asc' ? 1 : -1;

  return [...users].sort((left, right) => {
    if (
      sortBy === 'comment' &&
      (left.comment === null || right.comment === null)
    ) {
      if (left.comment === null && right.comment === null) {
        return (
          userCollator.compare(left.displayName, right.displayName) ||
          userCollator.compare(left.email, right.email)
        );
      }

      return left.comment === null ? 1 : -1;
    }

    if (sortBy === 'rating' && (left.rating === null || right.rating === null)) {
      if (left.rating === null && right.rating === null) {
        return (
          userCollator.compare(left.displayName, right.displayName) ||
          userCollator.compare(left.email, right.email)
        );
      }

      return left.rating === null ? 1 : -1;
    }

    const primary = compareAdminUsers(left, right, sortBy);

    if (primary !== 0) return primary * direction;

    return (
      userCollator.compare(left.displayName, right.displayName) ||
      userCollator.compare(left.email, right.email)
    );
  });
}

function matchesColumnFilters(
  user: AdminUserDto,
  query: AdminUsersQuery,
): boolean {
  if (
    query.comment &&
    !user.comment?.toLowerCase().includes(query.comment.toLowerCase())
  ) {
    return false;
  }

  if (query.listings !== undefined && user.listings !== query.listings) {
    return false;
  }

  if (query.deals !== undefined && user.deals !== query.deals) {
    return false;
  }

  if (query.copies !== undefined && user.copies !== query.copies) {
    return false;
  }

  if (query.rating !== undefined) {
    if (user.rating === null) return false;

    const userRating = Math.round(user.rating * 10) / 10;
    const queryRating = Math.round(query.rating * 10) / 10;

    if (userRating !== queryRating) return false;
  }

  if (query.createdAt) {
    const date = new Date(user.createdAt);
    const localDate = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');

    if (
      localDate !== query.createdAt &&
      user.createdAt.slice(0, 10) !== query.createdAt
    ) {
      return false;
    }
  }

  return true;
}

/** Administrator-only user directory and account status controls. */
export function registerUserAdminRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/admin/users',
    { preHandler: app.authenticate },
    async (request, reply) => {
      requireRoles(request, ['admin']);

      const query = parse(adminUsersQuerySchema, request.query);
      const search = query.search?.trim();
      const where: Prisma.UserWhereInput = {
        ...(query.role !== 'all' ? { role: query.role } : {}),
        ...(query.status !== 'all' ? { status: query.status } : {}),
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { displayName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const users = await app.prisma.user.findMany({
        where,
        select: adminUserSelect,
      });

      const userIds = users.map((user) => user.id);
      const [listingGroups, buyerGroups, sellerGroups] = await Promise.all([
        userIds.length
          ? app.prisma.marketEntry.groupBy({
              by: ['authorId'],
              where: {
                authorId: { in: userIds },
                deletedAt: null,
              },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        userIds.length
          ? app.prisma.deal.groupBy({
              by: ['buyerId'],
              where: {
                buyerId: { in: userIds },
                status: 'completed',
              },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        userIds.length
          ? app.prisma.deal.groupBy({
              by: ['sellerId'],
              where: {
                sellerId: { in: userIds },
                status: 'completed',
              },
              _count: { _all: true },
            })
          : Promise.resolve([]),
      ]);

      const listingsByUser = new Map(
        listingGroups.map((group) => [group.authorId, group._count._all]),
      );
      const dealsByUser = new Map<string, number>();

      for (const group of buyerGroups) {
        dealsByUser.set(
          group.buyerId,
          (dealsByUser.get(group.buyerId) ?? 0) + group._count._all,
        );
      }

      for (const group of sellerGroups) {
        dealsByUser.set(
          group.sellerId,
          (dealsByUser.get(group.sellerId) ?? 0) + group._count._all,
        );
      }

      const items = users
        .map((user) =>
          serializeAdminUser(
            user,
            listingsByUser.get(user.id) ?? 0,
            dealsByUser.get(user.id) ?? 0,
          ),
        )
        .filter((user) => matchesColumnFilters(user, query));

      const sortedItems = sortAdminUsers(items, query.sortBy, query.sortDir);
      const start = (query.page - 1) * query.pageSize;

      return reply.send(
        paginated(
          sortedItems.slice(start, start + query.pageSize),
          sortedItems.length,
          query.page,
          query.pageSize,
        ),
      );
    },
  );

  app.patch(
    '/api/v1/admin/users/:id/status',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const admin = requireRoles(request, ['admin']);
      const { id } = request.params as { id: string };
      const input = parse(adminUserStatusSchema, request.body);

      if (id === admin.id && input.status === 'suspended') {
        throw badRequest('Нельзя заблокировать собственный аккаунт.');
      }

      const target = await app.prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true },
      });

      if (!target) throw notFound('Пользователь не найден.');

      if (target.role === 'admin' && input.status === 'suspended') {
        throw forbidden('Нельзя заблокировать администратора.');
      }

      const user = await app.prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id },
          data: {
            status: input.status,
            suspendedAt: input.status === 'suspended' ? new Date() : null,
            comment:
              input.status === 'suspended' ? (input.reason ?? null) : null,
          },
        });

        if (input.status === 'suspended') {
          await tx.session.deleteMany({ where: { userId: id } });
        }

        return updated;
      });

      return reply.send({ user: await getUserProfile(app.prisma, user) });
    },
  );
}
