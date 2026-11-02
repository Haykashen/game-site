import { marketStatus, moderationStatus, statusCode, type StatusRecord } from './statusSource.js';
import type { Prisma, StatusEntity } from '@prisma/client';
import { badRequest } from '../errors.js';

export const STATUS_ENTITIES = ['Game','Edition','Listing','Auction','NewsPost','Discussion','User','Deal','Report'] as const;
export function statusEntity(name: string, data: Record<string, unknown>) {
  return name === 'MarketEntry' ? data.kind === 'auction' ? 'Auction' : 'Listing' : name;
}
export function recordStatus(row: Record<string, unknown>): string {
  return row.kind === 'listing' || row.kind === 'auction' ? marketStatus(row as StatusRecord) : statusCode(row as StatusRecord);
}
export function recordModeration(row: Record<string, unknown>): string { return moderationStatus(row as StatusRecord); }
/** Reference data is used for domain checks only, never submitted as a nested Prisma write. */
export function scalarStatusData(data: Record<string, unknown>) {
  const {statusReference: _reference, ...scalars} = data;
  return scalars;
}
export async function resolveStatus(tx: Prisma.TransactionClient, name: string, data: Record<string, unknown>, old: Record<string, unknown> = {}) {
  if (!STATUS_ENTITIES.includes(statusEntity(name, {...old, ...data}) as StatusEntity)) return;
  const entity = statusEntity(name, {...old, ...data}) as StatusEntity;
  if (data.statusId === undefined) {
    if (old.id && data.kind === undefined) return;
    const code = old.id ? statusCode(old as StatusRecord) : ['Game','Edition'].includes(name) || name === 'MarketEntry' ? 'draft' : name === 'User' ? 'active' : 'pending';
    const row = await tx.status.findUnique({where: {entity_code: {entity, code}}});
    if (!row) throw badRequest('Статус не найден в справочнике этой сущности.');
    data.statusId = row.id;
  }
  const row = await tx.status.findUnique({where: {id: String(data.statusId)}});
  if (!row || row.entity !== entity) throw badRequest('Выбранный статус не найден в справочнике этой сущности.');
  data.statusReference = {code: row.code};
}
