import { statusWhere } from '../lib/statusSource.js';
import { Prisma } from '@prisma/client';
import { applyModeration } from '../lib/moderation.js';
import { resolveStatus, STATUS_ENTITIES, recordStatus, recordModeration, scalarStatusData } from '../lib/statusDirectories.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dateOnlySchema, paginated, paginationSchema, type AdminReference, type AdminTable } from '@discvault/shared';
import { requireRoles } from '../auth/authorization.js';
import { hashPassword } from '../auth/password.js';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { isPrismaError } from '../lib/prismaErrors.js';
import { parse } from '../lib/validation.js';
import { getModel, getTable, models, parseCreateData, parseData, parseKey, recordSelect, TABLE_LABELS, uniqueWhere } from './metadata.js';
import { reconcileRecords, validateRecord } from './rules.js';

export type Row = Record<string, unknown>;
// Only the allowlisted model and scalar fields reach this narrow dynamic adapter.
interface Delegate {
  findMany(args: Row): Promise<Row[]>;
  findFirst(args: Row): Promise<Row | null>;
  count(args: Row): Promise<number>;
  create(args: Row): Promise<Row>;
  update(args: Row): Promise<Row>;
  delete(args: Row): Promise<Row>;
}
export function delegate(tx: Prisma.TransactionClient, name: string): Delegate {
  getModel(name);
  const key = name.charAt(0).toLowerCase() + name.slice(1);
  return (tx as unknown as Record<string, Delegate>)[key]!;
}
const querySchema = paginationSchema.extend({
  relatedUserId: z.string().uuid().optional(),
  search: z.string().trim().max(200).default(''),
  filters: z.string().max(20_000).optional(),
  sortBy: z.string().max(100).optional(), sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export function userScopeWhere(table: AdminTable, userId: string): Row {
  const fields = table.fields.filter((field) => field.reference === 'User');
  if (!fields.length) throw badRequest('Эта таблица не ссылается на пользователей.');
  return {OR: fields.map((field) => ({[field.name]: userId}))};
}
const updateSchema = z.object({data: z.record(z.unknown()), expectedUpdatedAt: z.string().datetime().nullable()}).strict();
const deleteSchema = z.object({expectedUpdatedAt: z.string().datetime().nullable()}).strict();

export function buildWhere(table: AdminTable, search: string, encodedFilters?: string): Row {
  const and: Row[] = [];
  if (search) {
    const fields = getModel(table.name).fields.filter((field) => field.type === 'String' && field.nativeType?.[0] !== 'Uuid' && !field.isList && table.fields.some((item) => item.name === field.name));
    if (fields.length) and.push({OR: fields.map((field) => ({[field.name]: {contains: search, mode: 'insensitive'}}))});
  }
  let filters: Record<string, string> = {};
  if (encodedFilters) {
    let value: unknown;
    try { value = JSON.parse(encodedFilters); } catch { throw badRequest('Некорректные фильтры.'); }
    filters = parse(z.record(z.string().max(2000)), value);
  }
  for (const [key, value] of Object.entries(filters)) {
    const field = table.fields.find((item) => item.name === key && item.type !== 'password');
    if (!field) throw badRequest('Неизвестный столбец фильтра.');
    if (!value) continue;
    const raw = getModel(table.name).fields.find((item) => item.name === key)!;
    if (field.type === 'number') {
      if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < -2147483648 || Number(value) > 2147483647) throw badRequest(`Некорректное число: ${field.label}.`);
      and.push({[key]: Number(value)});
    } else if (field.type === 'date') {
      const date = parse(dateOnlySchema, value);
      const start = new Date(date + 'T00:00:00.000Z');
      if (!Number.isFinite(start.getTime())) throw badRequest('Некорректная дата.');
      and.push({[key]: {gte: start, lt: new Date(start.getTime() + 86_400_000)}});
    } else if (field.type === 'boolean') {
      and.push({[key]: parse(z.enum(['true', 'false']), value) === 'true'});
    } else if (field.type === 'enum') {
      and.push({[key]: parse(z.enum(field.options as [string, ...string[]]), value)});
    } else if (table.name === 'Game' && key === 'genres') {
      and.push({genres: {some: {name: {contains: value, mode: 'insensitive'}}}});
    } else if (field.type === 'list') {
      if (field.options.length) parse(z.enum(field.options as [string, ...string[]]), value);
      and.push({[key]: {has: value}});
    } else if (raw.nativeType?.[0] === 'Uuid') {
      and.push({[key]: parse(z.string().uuid(), value)});
    } else {
      and.push({[key]: {contains: value, mode: 'insensitive'}});
    }
  }
  return and.length ? {AND: and} : {};
}

function checkVersion(table: AdminTable, old: Row, expected: string | null) {
  if (!table.fields.some((field) => field.name === 'updatedAt')) return;
  if (!(old.updatedAt instanceof Date) || old.updatedAt.toISOString() !== expected) {
    throw conflict('STALE_RECORD', 'Запись уже изменена. Закройте форму, обновите таблицу и повторите действие.');
  }
}

async function protectUser(tx: Prisma.TransactionClient, adminId: string, old: Row, data: Row, deleting: boolean) {
  if (old.id === adminId && (deleting || data.isDemo === true || (data.role !== undefined && data.role !== 'admin') || (data.statusId !== undefined && recordStatus(data) !== 'active'))) {
    throw forbidden('Нельзя удалить, заблокировать или понизить собственный аккаунт администратора.');
  }
  if (old.role === 'admin' && recordStatus(old) === 'active' && (deleting || data.isDemo === true || (data.role !== undefined && data.role !== 'admin') || (data.statusId !== undefined && recordStatus(data) !== 'active'))) {
    const count = await tx.user.count({where: {role: 'admin', ...statusWhere('active'), isDemo: false}});
    if (count <= 1) throw forbidden('В системе должен оставаться активный администратор.');
  }
}

/** Only a game's editions are removed automatically; user-owned data still blocks deletion. */
async function listDependencies(tx: Prisma.TransactionClient, table: AdminTable, old: Row) {
  const dependencies: string[] = [];
  for (const model of models) {
    if (table.name === 'User' && model.name === 'Session') continue; // Session revocation is automatic.
    if (table.name === 'Game' && model.name === 'Edition') continue;
    for (const relation of model.fields.filter((field) => field.kind === 'object' && field.type === table.name && field.relationFromFields?.length)) {
      const where = Object.fromEntries(relation.relationFromFields!.map((field, index) => [field, old[relation.relationToFields![index]!]]));
      const count = await delegate(tx, model.name).count({where});
      if (count) dependencies.push(`${TABLE_LABELS[model.name]}: ${count}`);
    }
  }
  if (table.name === 'Game') {
    const editions = await tx.edition.findMany({where: {gameId: String(old.id)}, select: {id: true}});
    const ids = editions.map(edition => edition.id);
    if (ids.length) {
      const copies = await tx.copy.count({where: {editionId: {in: ids}}});
      const entries = await tx.marketEntry.count({where: {editionId: {in: ids}, gameId: {not: String(old.id)}}});
      if (copies) dependencies.push(`Экземпляры в коллекциях: ${copies}`);
      if (entries) dependencies.push(`Объявления, использующие издания игры: ${entries}`);
    }
  }
  return dependencies;
}

async function checkDependencies(tx: Prisma.TransactionClient, table: AdminTable, old: Row) {
  const dependencies = await listDependencies(tx, table, old);
  if (dependencies.length) throw conflict('RELATED_RECORDS', 'Сначала удалите или переназначьте связанные записи: ' + dependencies.join('; ') + '.');
}

async function write<T>(app: FastifyInstance, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    return await app.prisma.$transaction(action, {isolationLevel: 'Serializable', timeout: 15000});
  } catch (error) {
    if (isPrismaError(error, 'P2002')) throw conflict('DUPLICATE_RECORD', 'Запись с такими уникальными значениями уже существует.');
    if (isPrismaError(error, 'P2003')) throw badRequest('Связанная запись не найдена или ещё используется другими данными.');
    if (isPrismaError(error, 'P2025')) throw notFound();
    if (isPrismaError(error, 'P2034')) throw conflict('CONCURRENT_CHANGE', 'Данные изменились одновременно. Обновите таблицу и повторите действие.');
    throw error;
  }
}

export function registerAdminDataRoutes(app: FastifyInstance): void {
  const auth = { preHandler: app.authenticate };
  app.get('/api/v1/admin/data', auth, async (request) => {
    const user = requireRoles(request, ['admin', 'moderator']);
    return {tables: user.role === 'admin' ? models.map(model => getTable(model.name)) : [{...getTable('Game'), canCreate: false, canDelete: false}]};
  });
  app.get('/api/v1/admin/data/:table/references', auth, async (request) => {
    const user = requireRoles(request, ['admin', 'moderator']);
    const {table: name} = request.params as {table: string};
    if (user.role !== 'admin' && !['GameSeries','GameGenre','Region','Status'].includes(name)) throw forbidden('Недостаточно прав для этого действия.');
    const table = getTable(name);
    const {search} = parse(querySchema, request.query);
    const entity = name === 'Status' ? parse(z.enum(STATUS_ENTITIES), (request.query as {entity?: string}).entity) : undefined;
    if (user.role !== 'admin' && name === 'Status' && entity !== 'Game') throw forbidden('Недостаточно прав для этого действия.');
    if (table.primaryKey.length !== 1) throw badRequest('Таблица имеет составной ключ.');
    const labelField = ['displayName', 'title', 'name', 'body', 'email'].find((key) => table.fields.some((field) => field.name === key)) ?? table.primaryKey[0]!;
    const searchWhere = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(search) ? {[table.primaryKey[0]!]: search} : buildWhere(table, search);
    const rows = await delegate(app.prisma, name).findMany({where: entity ? {AND:[{entity}, searchWhere]} : searchWhere, select: {[table.primaryKey[0]!]: true, [labelField]: true}, take: 30, orderBy: name === 'Status' ? {sortOrder:'asc'} : {[labelField]: 'asc'}});
    const items: AdminReference[] = rows.map((row) => ({value: String(row[table.primaryKey[0]!]), label: String(row[labelField]).slice(0, 100) + ' · ' + String(row[table.primaryKey[0]!])}));
    return {items};
  });
  app.get('/api/v1/admin/data/:table/records', auth, async (request) => {
    requireRoles(request, ['admin']);
    const {table: name} = request.params as {table: string};
    const table = getTable(name);
    const query = parse(querySchema, request.query);
    const filters = buildWhere(table, query.search, query.filters);
    const where = query.relatedUserId ? {AND: [filters, userScopeWhere(table, query.relatedUserId)]} : filters;
    const sort = query.sortBy ?? (table.fields.some((field) => field.name === 'createdAt') ? 'createdAt' : table.primaryKey[0]!);
    if (!table.fields.some((field) => field.name === sort && !['list', 'password'].includes(field.type))) throw badRequest('Некорректный столбец сортировки.');
    const orderBy = [{[sort]: query.sortDir}, ...table.primaryKey.filter((key) => key !== sort).map((key) => ({[key]: 'asc'}))];
    const result = await app.prisma.$transaction(async (tx) => {
      const db = delegate(tx, name);
      const total = await db.count({where});
      const referenceFields = table.fields.flatMap(field => {
        if (!field.reference || !Object.hasOwn(TABLE_LABELS, field.reference) || field.type === 'list') return [];
        const relation = getModel(name).fields.find(candidate => candidate.kind === 'object' && candidate.relationFromFields?.length === 1 && candidate.relationFromFields[0] === field.name);
        if (!relation) return [];
        const related = getTable(field.reference);
        const label = ['displayName', 'title', 'name', 'code'].find(key => related.fields.some(item => item.name === key));
        return label ? [{field: field.name, relation: relation.name, label}] : [];
      });
      const select = recordSelect(table);
      for (const reference of referenceFields) select[reference.relation] = {select: {[reference.label]: true}};
      const records = await db.findMany({where, select, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize});
      const items = records.map(row => {
        const result = {...row};
        for (const reference of referenceFields) {
          const related = row[reference.relation] as Record<string, unknown> | null;
          result['__reference_' + reference.field] = related?.[reference.label] ?? null;
          delete result[reference.relation];
        }
        return result;
      });
      return paginated(items, total, query.page, query.pageSize);
    }, {isolationLevel: 'RepeatableRead'});
    return result;
  });
  app.get('/api/v1/admin/data/:table/records/:key', auth, async (request) => {
    const user = requireRoles(request, ['admin', 'moderator']);
    const {table: name, key} = request.params as {table: string; key: string};
    if (user.role !== 'admin' && name !== 'Game') throw forbidden('Недостаточно прав для этого действия.');
    const table = getTable(name);
    const row = await delegate(app.prisma, name).findFirst({where: parseKey(table, key), select: recordSelect(table)});
    if (!row) throw notFound();
    return {record: row};
  });
  app.get('/api/v1/admin/data/:table/records/:key/dependencies', auth, async (request) => {
    requireRoles(request, ['admin']);
    const {table: name, key} = request.params as {table: string; key: string};
    const table = getTable(name);
    return app.prisma.$transaction(async (tx) => {
      const row = await delegate(tx, name).findFirst({where: parseKey(table, key), select: recordSelect(table)});
      if (!row) throw notFound();
      return {
        dependencies: await listDependencies(tx, table, row),
        autoDeleteEditions: name === 'Game' ? await tx.edition.count({where: {gameId: String(row.id)}}) : 0,
      };
    }, {isolationLevel: 'RepeatableRead'});
  });
  app.post('/api/v1/admin/data/:table/records', auth, async (request, reply) => {
    const admin = requireRoles(request, ['admin']);
    const {table: name} = request.params as {table: string};
    const table = getTable(name);
    if (!table.canCreate) throw forbidden('Сессии создаются только при входе пользователя.');
    const data = parseCreateData(table, request.body);
    if (name === 'User') {
      data.passwordHash = await hashPassword(data.password as string);
      delete data.password;
    }
    const record = await write(app, async (tx) => {
      await resolveStatus(tx, name, data);
      applyModeration(name, data, null, admin.id);
      if (name === 'User' && recordStatus(data) === 'suspended') data.suspendedAt = new Date();
      await validateRecord(tx, name, data, null);
      const created = await delegate(tx, name).create({data: scalarStatusData(data), select: recordSelect(table)});
      await reconcileRecords(tx, name, null, created);
      return delegate(tx, name).findFirst({where: Object.fromEntries(table.primaryKey.map((key) => [key, created[key]])), select: recordSelect(table)});
    });
    return reply.code(201).send({record});
  });
  app.patch('/api/v1/admin/data/:table/records/:key', auth, async (request) => {
    const admin = requireRoles(request, ['admin', 'moderator']);
    const {table: name, key: encodedKey} = request.params as {table: string; key: string};
    const table = getTable(name);
    if (admin.role !== 'admin' && name !== 'Game') throw forbidden('Недостаточно прав для этого действия.');
    if (!table.canEdit) throw forbidden('Сессию можно только отозвать.');
    const key = parseKey(table, encodedKey);
    const input = parse(updateSchema, request.body);
    const data = parseData(table, input.data, false);
    if (name === 'User' && data.password !== undefined) {
      data.passwordHash = await hashPassword(data.password as string);
      delete data.password;
    }
    const record = await write(app, async (tx) => {
      const db = delegate(tx, name);
      const old = await db.findFirst({where: key, select: recordSelect(table)});
      if (!old) throw notFound();
      checkVersion(table, old, input.expectedUpdatedAt);
      await resolveStatus(tx, name, data, old);
      if (name === 'MarketEntry' && old.kind === 'auction' && recordStatus(old) === 'active' && recordModeration(old) === 'visible' && Object.keys(data).some(field => !['statusId', 'statusReference', 'moderationNote'].includes(field))) throw conflict('ACTIVE_AUCTION_LOCKED', 'Активный лот нельзя редактировать. Создайте новый на основе текущего, а этот закройте или удалите.');
      applyModeration(name, data, old, admin.id);
      if (name === 'User') {
        await protectUser(tx, admin.id, old, data, false);
        if (data.statusId !== undefined && recordStatus(data) !== recordStatus(old)) data.suspendedAt = recordStatus(data) === 'suspended' ? new Date() : null;
        if (data.passwordHash !== undefined || data.role !== undefined || data.statusId !== undefined || data.isDemo !== undefined) await tx.session.deleteMany({where: {userId: String(old.id)}});
      }
      await validateRecord(tx, name, {...old, ...data}, old);
      if (name === 'MarketEntry') data.version = {increment: 1};
      const updated = await db.update({where: uniqueWhere(table, key), data: scalarStatusData(data), select: recordSelect(table)});
      await reconcileRecords(tx, name, old, updated);
      return db.findFirst({where: key, select: recordSelect(table)});
    });
    return {record};
  });
  app.delete('/api/v1/admin/data/:table/records/:key', auth, async (request, reply) => {
    const admin = requireRoles(request, ['admin']);
    const {table: name, key: encodedKey} = request.params as {table: string; key: string};
    const table = getTable(name);
    const key = parseKey(table, encodedKey);
    if (!table.canDelete) throw forbidden('Системные статусы нельзя удалять.');
    const input = parse(deleteSchema, request.body);
    await write(app, async (tx) => {
      const db = delegate(tx, name);
      const old = await db.findFirst({where: key, select: recordSelect(table)});
      if (!old) throw notFound();
      checkVersion(table, old, input.expectedUpdatedAt);
      if (name === 'User') await protectUser(tx, admin.id, old, {}, true);
      await checkDependencies(tx, table, old);
      if (name === 'Game') {
        // Break only internal canonical links, then remove all editions atomically with the game.
        await tx.edition.deleteMany({where: {gameId: String(old.id)}});
      }
      if (name === 'User') await tx.session.deleteMany({where: {userId: String(old.id)}});
      await db.delete({where: uniqueWhere(table, key)});
      await reconcileRecords(tx, name, old, null);
    });
    return reply.code(204).send();
  });
}
