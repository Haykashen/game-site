import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { AdminField, AdminTable } from '@discvault/shared';
import { displayNameSchema, emailSchema, passwordSchema } from '@discvault/shared';
import { badRequest, notFound } from '../errors.js';
import { parse } from '../lib/validation.js';

// An explicit allowlist: a newly added database model is never exposed automatically.
export const TABLE_LABELS: Record<string, string> = {
  User: 'Пользователи', Session: 'Сессии', Game: 'Игры', GameRating: 'Оценки игр',
  Edition: 'Издания', Copy: 'Экземпляры коллекций', CopyPhoto: 'Фото экземпляров',
  MarketEntry: 'Объявления и аукционы', MarketPhoto: 'Фото объявлений', Bid: 'Ставки',
  Deal: 'Сделки', Review: 'Отзывы', Report: 'Жалобы', Notification: 'Уведомления',
  GameSubscription: 'Подписки на игры', MarketEntrySubscription: 'Подписки на объявления',
  Discussion: 'Обсуждения', DiscussionComment: 'Комментарии', NewsPost: 'Новости',
};
const FIELD_LABELS: Record<string, string> = {
  id: 'ID', email: 'Почта', displayName: 'Имя', password: 'Пароль', phone: 'Телефон',
  city: 'Город', avatarUrl: 'Аватар', isDemo: 'Демо-аккаунт', role: 'Роль', status: 'Статус',
  suspendedAt: 'Дата блокировки', comment: 'Комментарий', ratingSum: 'Сумма оценок',
  ratingCount: 'Количество отзывов', createdAt: 'Создано', updatedAt: 'Обновлено',
  userId: 'Пользователь', userAgent: 'Браузер', ip: 'IP', expiresAt: 'Истекает', lastUsedAt: 'Последняя активность',
  title: 'Название', publisher: 'Издатель', developer: 'Разработчик', series: 'Серия',
  year: 'Год', genres: 'Жанры', description: 'Описание', coverImage: 'Обложка', gameId: 'Игра',
  score: 'Оценка', name: 'Название', platform: 'Платформа', region: 'Регион', lang: 'Язык',
  media: 'Носитель', releaseDate: 'Дата выхода', contents: 'Комплектация', coverImages: 'Обложки',
  barcode: 'Штрихкод', dnsProductId: 'ID товара DNS', dnsProductCode: 'Код товара DNS', canonicalId: 'Основное издание',
  editionId: 'Издание', condition: 'Состояние', completeness: 'Комплектность',
  purchasePriceMinor: 'Цена покупки, коп.', purchaseDate: 'Дата покупки', notes: 'Заметки',
  copyId: 'Экземпляр', url: 'URL фотографии', sortOrder: 'Порядок', entryId: 'Объявление',
  authorId: 'Автор', kind: 'Вид', itemType: 'Предмет', listingType: 'Тип объявления',
  priceMinor: 'Цена, коп.', deliveryServices: 'Службы доставки', internationalShipping: 'Международная доставка',
  packagingPriceMinor: 'Упаковка, коп.', shipsFrom: 'Город отправки', bidStepMinor: 'Шаг ставки, коп.',
  startsAt: 'Начало', endsAt: 'Окончание', currentPriceMinor: 'Текущая цена, коп.', bidCount: 'Количество ставок',
  winnerId: 'Победитель', version: 'Версия', isSeeded: 'Начальные данные', soldAt: 'Дата продажи', deletedAt: 'Дата удаления',
  moderationStatus: 'Модерация', moderationNote: 'Примечание модератора', moderatedAt: 'Дата модерации', moderatorId: 'Модератор',
  marketEntryId: 'Объявление', bidderId: 'Участник', amountMinor: 'Сумма, коп.', buyerId: 'Покупатель', sellerId: 'Продавец',
  completedAt: 'Дата завершения', dealId: 'Сделка', targetId: 'Получатель / объект', rating: 'Оценка', text: 'Текст',
  reporterId: 'Заявитель', targetType: 'Тип объекта', targetUserId: 'Пользователь жалобы', reason: 'Причина',
  action: 'Действие', moderatorNote: 'Ответ модератора', activeKey: 'Ключ активной жалобы', resolvedAt: 'Дата решения',
  type: 'Тип', message: 'Сообщение', actorId: 'Инициатор', dedupeKey: 'Ключ уведомления', readAt: 'Прочитано',
  notifyAuctions: 'Об аукционах', notifyListings: 'Об объявлениях', excerpt: 'Краткое описание', body: 'Содержание',
  tags: 'Теги', pinned: 'Закреплено', views: 'Просмотры', discussionId: 'Обсуждение', parentId: 'Родительский комментарий',
  category: 'Категория', publishedAt: 'Опубликовано',
};
const HIDDEN = new Set(['passwordHash', 'tokenHash']);
const READ_ONLY = new Set(['updatedAt', 'ratingSum', 'ratingCount', 'bidCount', 'currentPriceMinor', 'winnerId', 'version', 'views', 'activeKey']);
export const models = Prisma.dmmf.datamodel.models.filter((model) => Object.hasOwn(TABLE_LABELS, model.name));

export function getModel(name: string) {
  const model = models.find((item) => item.name === name);
  if (!model) throw notFound('Таблица не найдена.');
  return model;
}

export function getTable(name: string): AdminTable {
  const model = getModel(name);
  const primaryKey = [...(model.primaryKey?.fields ?? model.fields.filter((field) => field.isId).map((field) => field.name))];
  const fields: AdminField[] = model.fields.filter((field) => field.kind !== 'object' && !HIDDEN.has(field.name)).map((field) => {
    const relation = model.fields.find((candidate) => candidate.kind === 'object' && candidate.relationFromFields?.includes(field.name));
    return {
      name: field.name, label: FIELD_LABELS[field.name] ?? field.name,
      type: field.isList ? 'list' : field.kind === 'enum' ? 'enum' : field.type === 'Int' ? 'number' : field.type === 'Boolean' ? 'boolean' : field.type === 'DateTime' ? 'date' : 'string',
      required: field.isRequired && !field.hasDefaultValue && !field.isUpdatedAt && !field.isList,
      nullable: !field.isRequired, generated: Boolean(field.hasDefaultValue || field.isUpdatedAt),
      primary: primaryKey.includes(field.name), readOnly: READ_ONLY.has(field.name) || name === 'Session',
      options: Prisma.dmmf.datamodel.enums.find((item) => item.name === field.type)?.values.map((value) => value.name) ?? [],
      reference: relation?.type ?? null,
      multiline: ['description', 'body', 'excerpt', 'text', 'message', 'notes', 'comment', 'moderatorNote', 'moderationNote'].includes(field.name),
      dateOnly: field.nativeType?.[0] === 'Date',
    };
  });
  if (name === 'User') fields.push({name: 'password', label: 'Пароль', type: 'password', required: true, nullable: false, generated: false, primary: false, readOnly: false, options: [], reference: null, multiline: false, dateOnly: false});
  return {name, label: TABLE_LABELS[name] ?? name, fields, primaryKey, canCreate: name !== 'Session', canEdit: name !== 'Session', canDelete: true};
}

export function recordSelect(table: AdminTable): Record<string, true> {
  return Object.fromEntries(table.fields.filter((field) => field.type !== 'password').map((field) => [field.name, true]));
}

/** Build a strict scalar schema: nested Prisma writes and computed fields are rejected. */
export function parseData(table: AdminTable, body: unknown, creating: boolean): Record<string, unknown> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of table.fields) {
    if (field.readOnly || (!creating && field.primary)) continue;
    let schema: z.ZodTypeAny;
    switch (field.type) {
      case 'number': schema = z.number().int().min(-2147483648).max(2147483647); break;
      case 'boolean': schema = z.boolean(); break;
      case 'date': schema = z.string().datetime({ offset: true }).transform((value) => new Date(value)); break;
      case 'enum': schema = z.enum(field.options as [string, ...string[]]); break;
      case 'list': schema = z.array(field.options.length ? z.enum(field.options as [string, ...string[]]) : z.string().max(2_000_000)).max(200); break;
      case 'password': schema = passwordSchema; break;
      default: schema = z.string().max(field.multiline ? 100_000 : field.name.toLowerCase().includes('url') || field.name === 'coverImage' ? 2_000_000 : 2000);
    }
    const raw = getModel(table.name).fields.find((item) => item.name === field.name);
    if (field.required && field.type === 'string') schema = (schema as z.ZodString).trim().min(1);
    if (field.primary || field.reference) schema = z.string().trim().min(1).max(100);
    if (raw?.nativeType?.[0] === 'Uuid') schema = z.string().uuid();
    if (table.name === 'User') {
      if (field.name === 'email') schema = emailSchema;
      if (field.name === 'displayName') schema = displayNameSchema;
      if (field.name === 'comment') schema = z.string().trim().max(2000);
      if (field.name === 'phone') schema = z.string().trim().max(30);
      if (field.name === 'city') schema = z.string().trim().max(80);
    }
    if (field.type === 'number' && (field.name.endsWith('Minor') || field.name === 'sortOrder')) schema = z.number().int().min(0).max(2147483647);
    if (table.name === 'Review' && field.name === 'rating') schema = z.number().int().min(1).max(5);
    if (table.name === 'GameRating' && field.name === 'score') schema = z.number().int().min(1).max(10);
    if (field.nullable) schema = schema.nullable();
    if (!creating || !field.required) schema = schema.optional();
    shape[field.name] = schema;
  }
  const data = parse(z.object(shape).strict(), body) as Record<string, unknown>;
  if (!Object.keys(data).length) throw badRequest('Не переданы поля для сохранения.');
  return data;
}

export function parseKey(table: AdminTable, key: string): Record<string, string> {
  let value: unknown;
  try { value = JSON.parse(key); } catch { throw badRequest('Некорректный ключ записи.'); }
  const fields = getModel(table.name).fields;
  return parse(z.object(Object.fromEntries(table.primaryKey.map((name) => [name, fields.find((field) => field.name === name)?.nativeType?.[0] === 'Uuid' ? z.string().uuid() : z.string().min(1).max(500)]))).strict(), value) as Record<string, string>;
}

export function uniqueWhere(table: AdminTable, key: Record<string, string>): Record<string, unknown> {
  return table.primaryKey.length === 1 ? key : { [table.primaryKey.join('_')]: key };
}
