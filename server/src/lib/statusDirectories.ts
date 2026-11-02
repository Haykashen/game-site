import type { Prisma } from '@prisma/client';
import { badRequest } from '../errors.js';

export const STATUS_ENTITIES = ['Game','Edition','Listing','Auction','NewsPost','Discussion','User','Deal','Report'] as const;
export function statusEntity(name: string, data: Record<string, unknown>) {
  return name === 'MarketEntry' ? data.kind === 'auction' ? 'Auction' : 'Listing' : name;
}

/** Translate a selected lifecycle reference for business checks and compatibility APIs. */
export async function resolveStatus(tx: Prisma.TransactionClient, name: string, data: Record<string, unknown>, old: Record<string, unknown> = {}) {
  if (data.statusId === undefined) return;
  const row = await tx.status.findUnique({where: {id: String(data.statusId)}});
  if (!row || row.entity !== statusEntity(name, {...old,...data})) throw badRequest('Выбранный статус не найден в справочнике этой сущности.');
  if (name === 'MarketEntry') {
    data.status = row.code === 'sold' || row.code === 'closed' ? row.code : 'active';
    data.moderationStatus = ['active','sold','closed'].includes(row.code) ? 'visible' : row.code === 'rejected' ? 'hidden' : row.code;
  } else if (['Game','Edition','NewsPost','Discussion'].includes(name)) data.moderationStatus = row.code;
  else data.status = row.code;
}
