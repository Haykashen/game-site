import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import {
  createCopySchema,
  editionQuantitySchema,
  fromMinorUnits,
  toMinorUnits,
  updateCopySchema,
  type CollectionStatsDto,
  type CopyDetailsInput,
  type CopyDto,
} from '@discvault/shared';
import { conflict, notFound, unauthorized } from '../errors.js';
import { serializeCopy } from '../lib/serializers.js';
import { storePhotoReferences } from '../lib/storage.js';
import { parse } from '../lib/validation.js';

const copyInclude = {
  photos: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.CopyInclude;

const DEFAULT_CONDITION = 'Не указано';
const DEFAULT_COMPLETENESS = 'Не указано';
const MAX_QUANTITY = 99;

function dateFromInput(value: string | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === '') return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function sharedDetailsData(details: CopyDetailsInput): Prisma.CopyUpdateManyMutationInput {
  const data: Prisma.CopyUpdateManyMutationInput = {};

  if (details.condition !== undefined) data.condition = details.condition;
  if (details.completeness !== undefined) data.completeness = details.completeness;
  if (details.purchasePrice !== undefined) {
    data.purchasePriceMinor =
      details.purchasePrice === null ? null : toMinorUnits(details.purchasePrice);
  }
  if (details.purchaseDate !== undefined) {
    data.purchaseDate =
      details.purchaseDate === ''
        ? null
        : new Date(`${details.purchaseDate}T00:00:00.000Z`);
  }
  if (details.notes !== undefined) data.notes = details.notes;

  return data;
}

function photoCreateData(urls: readonly string[]): Prisma.CopyPhotoCreateWithoutCopyInput[] {
  return urls.map((url, index) => ({ url, sortOrder: index }));
}

async function getEditionCopies(
  app: FastifyInstance,
  userId: string,
  editionId: string,
): Promise<CopyDto[]> {
  const copies = await app.prisma.copy.findMany({
    where: { userId, editionId },
    include: copyInclude,
    orderBy: { createdAt: 'asc' },
  });

  return copies.map(serializeCopy);
}

export function registerCollectionRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/collection/copies',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const copies = await app.prisma.copy.findMany({
        where: { userId: user.id },
        include: copyInclude,
        orderBy: { createdAt: 'desc' },
      });

      return reply.send(copies.map(serializeCopy));
    },
  );

  app.post(
    '/api/v1/collection/copies',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const input = parse(createCopySchema, request.body);

      const edition = await app.prisma.edition.findUnique({
        where: { id: input.editionId },
        select: { id: true },
      });

      if (!edition) throw notFound('Издание не найдено.');

      const existing = await app.prisma.copy.findMany({
        where: { userId: user.id, editionId: input.editionId },
        include: copyInclude,
        orderBy: { createdAt: 'asc' },
      });

      if (existing.length >= MAX_QUANTITY) {
        throw conflict('QUANTITY_LIMIT', `В коллекции может быть не больше ${MAX_QUANTITY} экземпляров одного издания.`);
      }

      const representative = existing[0];
      const photos =
        input.photos !== undefined
          ? await storePhotoReferences(input.photos, 'collection')
          : [];

      const copy = await app.prisma.copy.create({
        data: {
          userId: user.id,
          editionId: input.editionId,
          condition: input.condition ?? representative?.condition ?? DEFAULT_CONDITION,
          completeness:
            input.completeness ?? representative?.completeness ?? DEFAULT_COMPLETENESS,
          purchasePriceMinor:
            input.purchasePrice !== undefined
              ? input.purchasePrice === null
                ? null
                : toMinorUnits(input.purchasePrice)
              : (representative?.purchasePriceMinor ?? null),
          purchaseDate:
            input.purchaseDate !== undefined
              ? (dateFromInput(input.purchaseDate) ?? null)
              : (representative?.purchaseDate ?? null),
          notes: input.notes ?? representative?.notes ?? '',
          ...(photos.length > 0
            ? { photos: { create: photoCreateData(photos) } }
            : {}),
        },
        include: copyInclude,
      });

      return reply.code(201).send(serializeCopy(copy));
    },
  );

  app.patch(
    '/api/v1/collection/copies/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const { id } = request.params as { id: string };
      const input = parse(updateCopySchema, request.body);

      const existing = await app.prisma.copy.findUnique({ where: { id } });

      if (!existing || existing.userId !== user.id) {
        throw notFound('Экземпляр не найден.');
      }

      const shared = sharedDetailsData(input);
      const photos =
        input.photos !== undefined
          ? await storePhotoReferences(input.photos, 'collection')
          : undefined;

      const copy = await app.prisma.copy.update({
        where: { id },
        data: {
          ...shared,
          ...(photos !== undefined
            ? {
                photos: {
                  deleteMany: {},
                  create: photoCreateData(photos),
                },
              }
            : {}),
        },
        include: copyInclude,
      });

      return reply.send(serializeCopy(copy));
    },
  );

  app.delete(
    '/api/v1/collection/copies/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const { id } = request.params as { id: string };
      const existing = await app.prisma.copy.findUnique({ where: { id } });

      if (!existing || existing.userId !== user.id) {
        throw notFound('Экземпляр не найден.');
      }

      await app.prisma.copy.delete({ where: { id } });

      return reply.code(204).send();
    },
  );

  app.put(
    '/api/v1/collection/editions/:editionId/quantity',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const { editionId } = request.params as { editionId: string };
      const { quantity } = parse(editionQuantitySchema, request.body);

      const edition = await app.prisma.edition.findUnique({
        where: { id: editionId },
        select: { id: true },
      });

      if (!edition) throw notFound('Издание не найдено.');

      await app.prisma.$transaction(
        async (tx) => {
          const copies = await tx.copy.findMany({
            where: { userId: user.id, editionId },
            include: copyInclude,
            orderBy: { createdAt: 'asc' },
          });

          if (copies.length === quantity) return;

          if (quantity === 0) {
            await tx.copy.deleteMany({ where: { userId: user.id, editionId } });
            return;
          }

          if (quantity > copies.length) {
            const representative = copies[0];

            await tx.copy.createMany({
              data: Array.from({ length: quantity - copies.length }, () => ({
                userId: user.id,
                editionId,
                condition: representative?.condition ?? DEFAULT_CONDITION,
                completeness: representative?.completeness ?? DEFAULT_COMPLETENESS,
                purchasePriceMinor: representative?.purchasePriceMinor ?? null,
                purchaseDate: representative?.purchaseDate ?? null,
                notes: representative?.notes ?? '',
              })),
            });
            return;
          }

          const removeIds = copies
            .slice(quantity)
            .map((copy) => copy.id);

          await tx.copy.deleteMany({
            where: { id: { in: removeIds }, userId: user.id },
          });
        },
        { isolationLevel: 'Serializable' },
      );

      const copies = await getEditionCopies(app, user.id, editionId);
      return reply.send(copies);
    },
  );

  app.patch(
    '/api/v1/collection/editions/:editionId',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const { editionId } = request.params as { editionId: string };
      const input = parse(updateCopySchema, request.body);

      const copies = await app.prisma.copy.findMany({
        where: { userId: user.id, editionId },
        orderBy: { createdAt: 'asc' },
      });

      if (copies.length === 0) throw notFound('В коллекции нет этого издания.');

      const shared = sharedDetailsData(input);
      const photos =
        input.photos !== undefined
          ? await storePhotoReferences(input.photos, 'collection')
          : undefined;

      await app.prisma.$transaction(async (tx) => {
        await tx.copy.updateMany({
          where: { userId: user.id, editionId },
          data: shared,
        });

        if (photos === undefined) return;

        const representative = copies[0];
        if (!representative) return;

        await tx.copy.update({
          where: { id: representative.id },
          data: {
            photos: {
              deleteMany: {},
              create: photoCreateData(photos),
            },
          },
        });

        const otherIds = copies.slice(1).map((copy) => copy.id);

        if (otherIds.length > 0) {
          await tx.copyPhoto.deleteMany({ where: { copyId: { in: otherIds } } });
        }
      });

      return reply.send(await getEditionCopies(app, user.id, editionId));
    },
  );

  app.delete(
    '/api/v1/collection/editions/:editionId',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const { editionId } = request.params as { editionId: string };

      const result = await app.prisma.copy.deleteMany({
        where: { userId: user.id, editionId },
      });

      if (result.count === 0) throw notFound('В коллекции нет этого издания.');

      return reply.code(204).send();
    },
  );

  app.get(
    '/api/v1/collection/stats',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const copies = await app.prisma.copy.findMany({
        where: { userId: user.id },
        select: { editionId: true, purchasePriceMinor: true },
      });

      const editionIds = [...new Set(copies.map((copy) => copy.editionId))];
      const editions = await app.prisma.edition.findMany({
        where: { id: { in: editionIds } },
        select: { id: true, gameId: true, platform: true },
      });

      const platforms = new Map<string, number>();
      const platformByEdition = new Map(
        editions.map((edition) => [edition.id, edition.platform]),
      );

      for (const copy of copies) {
        const platform = platformByEdition.get(copy.editionId) ?? 'Другое';
        platforms.set(platform, (platforms.get(platform) ?? 0) + 1);
      }

      const priced = copies.filter((copy) => copy.purchasePriceMinor !== null);
      const totalSpentMinor = priced.reduce(
        (sum, copy) => sum + (copy.purchasePriceMinor ?? 0),
        0,
      );

      const body: CollectionStatsDto = {
        copiesCount: copies.length,
        editionsCount: editionIds.length,
        gamesCount: new Set(editions.map((edition) => edition.gameId)).size,
        totalSpent: fromMinorUnits(totalSpentMinor),
        averagePrice:
          priced.length > 0
            ? Math.round((totalSpentMinor / priced.length / 100) * 100) / 100
            : null,
        platforms: [...platforms.entries()]
          .map(([platform, count]) => ({ platform, copies: count }))
          .sort((a, b) => b.copies - a.copies),
      };

      return reply.send(body);
    },
  );
}
