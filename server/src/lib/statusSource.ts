import type { Prisma, StatusEntity } from '@prisma/client';
import type { MarketStatus, MarketModerationStatus as ModerationStatus } from '@discvault/shared';
import { badRequest } from '../errors.js';

export type StatusRecord = { statusReference: { code: string } };
export function statusCode(row: StatusRecord): string { return row.statusReference.code; }
/** Compatibility projections at API boundaries; neither value is stored separately. */
export function marketStatus(row: StatusRecord): MarketStatus {
  const code = statusCode(row);
  return code === 'sold' || code === 'closed' ? code : 'active';
}
export function moderationStatus(row: StatusRecord): ModerationStatus {
  const code = statusCode(row);
  return (['active', 'sold', 'closed'].includes(code) ? 'visible' : code === 'rejected' ? 'hidden' : code) as ModerationStatus;
}

type StatusFilter = string | {equals?: string; in?: string[]; notIn?: string[]; not?: StatusFilter};
type StatusModel = Exclude<StatusEntity, 'Listing' | 'Auction'> | 'MarketEntry';
const marketCodes = ['draft', 'pending', 'active', 'rejected', 'removed', 'sold', 'closed'];
function matches(value: string, filter: StatusFilter): boolean {
  if (typeof filter === 'string') return value === filter;
  const f = filter;
  return (!f.equals || value === f.equals) && (!f.in || f.in.includes(value)) && (!f.notIn || !f.notIn.includes(value)) && (f.not === undefined || !matches(value, f.not));
}
export function statusWhere(filter: string | Prisma.StringFilter) {
  return { statusReference: { code: filter } };
}
export function marketStatusWhere(filter: { status?: StatusFilter; moderationStatus?: StatusFilter }) {
  const codes = marketCodes.filter(code => {
    const row = { statusReference: { code } };
    return (filter.status === undefined || matches(marketStatus(row), filter.status)) &&
      (filter.moderationStatus === undefined || matches(moderationStatus(row), filter.moderationStatus));
  });
  return statusWhere({ in: codes });
}

/** Resolve codes through the directory, including partial marketplace transitions. */
export async function statusWrite(tx: Prisma.TransactionClient, model: StatusModel,
  patch: { status?: string; moderationStatus?: string; kind?: string }, recordId?: string) {
  let entity = model as StatusEntity;
  let code = String(patch.moderationStatus ?? patch.status);
  if (model === 'MarketEntry') {
    const old = recordId ? await tx.marketEntry.findFirst({ where: {id: recordId}, select: {kind: true, statusReference: {select: {code: true}}} }) : null;
    const kind = patch.kind ?? old?.kind;
    if (kind !== 'listing' && kind !== 'auction') throw badRequest('Не удалось определить вид объявления для статуса.');
    entity = kind === 'auction' ? 'Auction' : 'Listing';
    const oldCode = old ? statusCode(old) : 'pending';
    const lifecycle = patch.status ?? (old ? marketStatus(old) : 'active');
    const moderation = patch.moderationStatus ?? (old ? moderationStatus(old) : 'pending');
    code = lifecycle === 'sold' || lifecycle === 'closed' ? String(lifecycle)
      : moderation === 'visible' ? 'active' : moderation === 'hidden' ? 'rejected' : String(moderation);
    // Reopening a published terminal entry resumes publication; a draft stays a draft.
    if (patch.status === 'active' && ['sold', 'closed'].includes(oldCode) && patch.moderationStatus === undefined) code = 'active';
  }
  const row = await tx.status.findUnique({where: {entity_code: {entity, code}}, select: {id: true}});
  if (!row) throw badRequest('Статус не найден в справочнике этой сущности.');
  return {statusId: row.id};
}
