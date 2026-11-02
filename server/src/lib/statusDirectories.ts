import type { Prisma } from '@prisma/client';
import { badRequest } from '../errors.js';

export const STATUS_DIRECTORY: Record<string, string> = {Game:'gameStatus', Edition:'gameStatus', MarketEntry:'marketEntryStatus', NewsPost:'contentStatus', Discussion:'contentStatus', User:'accountStatus', Deal:'transactionStatus', Report:'complaintStatus'};

/** Translate a selected lifecycle reference for business checks and compatibility APIs. */
export async function resolveStatus(tx: Prisma.TransactionClient, name: string, data: Record<string, unknown>) {
  if (data.statusId === undefined || !STATUS_DIRECTORY[name]) return;
  const delegate = (tx as unknown as Record<string, {findUnique: (args: unknown) => Promise<{code: string} | null>}>)[STATUS_DIRECTORY[name]!]!;
  const row = await delegate.findUnique({where: {id: data.statusId}});
  if (!row) throw badRequest('Выбранный статус не найден в справочнике этой сущности.');
  if (name === 'MarketEntry') {
    data.status = row.code === 'sold' || row.code === 'closed' ? row.code : 'active';
    data.moderationStatus = ['active','sold','closed'].includes(row.code) ? 'visible' : row.code === 'rejected' ? 'hidden' : row.code;
  } else if (['Game','Edition','NewsPost','Discussion'].includes(name)) data.moderationStatus = row.code;
  else data.status = row.code;
}
